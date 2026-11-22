import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BookDocument, ChapterEntry, RawOutlineItem } from '../types/pdf';
import {
  buildChaptersFromOutlineItems,
  detectHeadingFromPageText,
  generateFixedChunkChapters,
} from './chapterPlanner';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfPreviewProxy = PDFDocumentProxy;

export async function openPdfPreviewHandle(bytes: Uint8Array): Promise<PdfPreviewProxy> {
  // Always pass a copy so worker ArrayBuffer transfer never detaches the caller's bytes
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  return loadingTask.promise;
}

async function resolveOutlineDestToPage(
  pdfDoc: PDFDocumentProxy,
  dest: unknown
): Promise<number | null> {
  try {
    let explicitDest = dest;
    if (typeof dest === 'string') {
      explicitDest = await pdfDoc.getDestination(dest);
    }
    if (!Array.isArray(explicitDest) || explicitDest.length === 0) {
      return null;
    }
    const ref = explicitDest[0];
    if (typeof ref === 'number') {
      return ref + 1;
    }
    if (ref && typeof ref === 'object') {
      const pageIndex = await pdfDoc.getPageIndex(ref as never);
      return pageIndex + 1;
    }
    return null;
  } catch {
    return null;
  }
}

interface PdfJsOutlineNode {
  title: string;
  dest: unknown;
  items?: PdfJsOutlineNode[];
}

async function collectOutlineItems(
  pdfDoc: PDFDocumentProxy,
  nodes: PdfJsOutlineNode[],
  level = 0,
  maxDepth = 1
): Promise<RawOutlineItem[]> {
  const results: RawOutlineItem[] = [];

  for (const node of nodes) {
    const title = (node.title || '').trim();
    const pageNumber = await resolveOutlineDestToPage(pdfDoc, node.dest);
    if (title && pageNumber && pageNumber >= 1 && pageNumber <= pdfDoc.numPages) {
      results.push({ title, pageNumber, level });
    }
    if (level < maxDepth && Array.isArray(node.items) && node.items.length > 0) {
      // Only descend into children when parent looks like a Part container or when top-level has few nodes
      const looksLikePart = /^part\s+([ivxlcdm]+|\d+)\b/i.test(title);
      if (looksLikePart || nodes.length <= 6) {
        const children = await collectOutlineItems(pdfDoc, node.items, level + 1, maxDepth);
        results.push(...children);
      }
    }
  }

  return results;
}

async function scanPagesForHeadings(
  pdfDoc: PDFDocumentProxy,
  maxPagesToScan = 160
): Promise<RawOutlineItem[]> {
  const found: RawOutlineItem[] = [];
  const limit = Math.min(pdfDoc.numPages, maxPagesToScan);

  for (let pageNum = 1; pageNum <= limit; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const text = item.str;
        const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = text;
        } else {
          currentLine += (currentLine && text && !currentLine.endsWith(' ') ? ' ' : '') + text;
        }
        if (y !== null) lastY = y;
        if (lines.length >= 8) break;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      const detected = detectHeadingFromPageText(lines, pageNum);
      if (detected) {
        found.push(detected);
      }
    } catch {
      // Skip pages that fail text extraction
    }
  }

  return found;
}

export async function analyzeUploadedPdf(
  bytes: Uint8Array,
  fileName: string,
  fileSizeBytes: number
): Promise<{
  book: BookDocument;
  chapters: ChapterEntry[];
  previewProxy: PdfPreviewProxy;
}> {
  const previewProxy = await openPdfPreviewHandle(bytes);
  const totalPages = previewProxy.numPages;

  let metaTitle = '';
  let metaAuthor = '';
  try {
    const metadata = await previewProxy.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;
    if (info && typeof info.Title === 'string' && info.Title.trim().length > 1) {
      metaTitle = info.Title.trim();
    }
    if (info && typeof info.Author === 'string' && info.Author.trim().length > 1) {
      metaAuthor = info.Author.trim();
    }
  } catch {
    // Metadata optional
  }

  const cleanFileBase = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const title = metaTitle || cleanFileBase || 'Uploaded PDF Document';

  let chapters: ChapterEntry[] = [];
  let detectionMethod: BookDocument['detectionMethod'] = 'page-chunks';

  // 1. Try embedded PDF outline / bookmarks first
  try {
    const outline = (await previewProxy.getOutline()) as PdfJsOutlineNode[] | null;
    if (outline && outline.length > 0) {
      const rawItems = await collectOutlineItems(previewProxy, outline, 0, 1);
      const parsed = buildChaptersFromOutlineItems(rawItems, totalPages);
      if (parsed.length >= 2) {
        chapters = parsed;
        detectionMethod = 'pdf-outline';
      }
    }
  } catch {
    // Outline optional
  }

  // 2. Fallback: scan top-of-page lines for Chapter / Part / Appendix headings
  if (chapters.length === 0) {
    const scanned = await scanPagesForHeadings(previewProxy);
    if (scanned.length >= 2) {
      const parsed = buildChaptersFromOutlineItems(scanned, totalPages);
      if (parsed.length >= 2) {
        chapters = parsed;
        detectionMethod = 'heading-scan';
      }
    }
  }

  // 3. Fallback: clean fixed-size chapter chunks scaled to document length
  if (chapters.length === 0) {
    const chunkSize = totalPages <= 12 ? Math.max(2, Math.ceil(totalPages / 3)) : totalPages <= 60 ? 10 : 25;
    chapters = generateFixedChunkChapters(totalPages, chunkSize, 'Chapter');
    detectionMethod = 'page-chunks';
  }

  const book: BookDocument = {
    id: `uploaded-${Date.now()}`,
    title,
    authors: metaAuthor || undefined,
    fileName,
    totalPages,
    fileSizeBytes,
    sourceType: 'uploaded',
    detectionMethod,
  };

  return { book, chapters, previewProxy };
}

export async function renderPdfPageToCanvas(
  pdfDoc: PdfPreviewProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetCssWidth: number,
  activeRenderRef?: { current: RenderTask | null }
): Promise<{ width: number; height: number }> {
  const safePage = Math.max(1, Math.min(pdfDoc.numPages, pageNumber));
  const page = await pdfDoc.getPage(safePage);

  if (activeRenderRef?.current) {
    try {
      activeRenderRef.current.cancel();
    } catch {
      // Ignore cancel errors
    }
    activeRenderRef.current = null;
  }

  const unscaledViewport = page.getViewport({ scale: 1 });
  const cssScale = Math.max(0.25, targetCssWidth / unscaledViewport.width);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: cssScale * dpr });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });

  if (activeRenderRef) {
    activeRenderRef.current = renderTask;
  }

  await renderTask.promise;

  if (activeRenderRef && activeRenderRef.current === renderTask) {
    activeRenderRef.current = null;
  }

  return {
    width: Math.floor(viewport.width / dpr),
    height: Math.floor(viewport.height / dpr),
  };
}
