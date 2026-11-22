import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import type { ArchivePlan, ChapterEntry, ExportProgress } from '../types/pdf';

export async function extractRangesToPdfBytes(
  sourceDoc: PDFDocument,
  pageRanges: Array<{ startPage: number; endPage: number }>,
  metadata?: { title?: string; subject?: string }
): Promise<Uint8Array> {
  const totalPages = sourceDoc.getPageCount();
  const targetDoc = await PDFDocument.create();

  const pageIndices: number[] = [];
  for (const range of pageRanges) {
    const startIdx = Math.max(0, Math.min(totalPages - 1, range.startPage - 1));
    const endIdx = Math.max(startIdx, Math.min(totalPages - 1, range.endPage - 1));
    for (let i = startIdx; i <= endIdx; i++) {
      pageIndices.push(i);
    }
  }

  if (pageIndices.length > 0) {
    const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
    for (const page of copiedPages) {
      targetDoc.addPage(page);
    }
  }

  if (metadata?.title) {
    targetDoc.setTitle(metadata.title);
  }
  if (metadata?.subject) {
    targetDoc.setSubject(metadata.subject);
  }
  targetDoc.setProducer('FolioSplit PDF Chapter Bundler');

  return targetDoc.save();
}

export async function extractSingleChapterPdf(
  sourceBytes: Uint8Array,
  chapter: ChapterEntry,
  bookTitle?: string
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  return extractRangesToPdfBytes(
    sourceDoc,
    [{ startPage: chapter.startPage, endPage: chapter.endPage }],
    {
      title: `${chapter.code ? `${chapter.code}: ` : ''}${chapter.title}`,
      subject: bookTitle ? `${bookTitle} — ${chapter.partTitle}` : chapter.partTitle,
    }
  );
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function buildChapterZipBytes(
  sourceBytes: Uint8Array,
  plan: ArchivePlan,
  includeManifest: boolean,
  bookTitle: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<Uint8Array> {
  if (plan.files.length === 0) {
    throw new Error('Select at least one valid chapter before exporting.');
  }

  onProgress?.({
    phase: 'preparing',
    currentIndex: 0,
    totalFiles: plan.files.length,
    currentLabel: 'Parsing source PDF document…',
    percent: 4,
  });

  await yieldToMainThread();
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const zip = new JSZip();

  for (let i = 0; i < plan.files.length; i++) {
    const fileSpec = plan.files[i];
    const progressPercent = Math.round(8 + ((i + 0.5) / plan.files.length) * 76);

    onProgress?.({
      phase: 'splitting',
      currentIndex: i + 1,
      totalFiles: plan.files.length,
      currentLabel: fileSpec.label,
      percent: progressPercent,
    });

    await yieldToMainThread();
    const pdfBytes = await extractRangesToPdfBytes(sourceDoc, fileSpec.pageRanges, {
      title: fileSpec.label,
      subject: `${bookTitle} — ${fileSpec.partTitle}`,
    });

    zip.file(fileSpec.zipPath, pdfBytes, { binary: true });
  }

  if (includeManifest) {
    zip.file('MANIFEST.txt', plan.manifestContent);
  }

  onProgress?.({
    phase: 'compressing',
    currentIndex: plan.files.length,
    totalFiles: plan.files.length,
    currentLabel: `Compressing ${plan.archiveFileName}…`,
    percent: 90,
  });

  const zipBytes = await zip.generateAsync(
    {
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    },
    (meta) => {
      const scaled = Math.round(88 + (meta.percent / 100) * 11);
      onProgress?.({
        phase: 'compressing',
        currentIndex: plan.files.length,
        totalFiles: plan.files.length,
        currentLabel: `Packaging ZIP (${Math.round(meta.percent)}%)…`,
        percent: Math.min(99, scaled),
      });
    }
  );

  onProgress?.({
    phase: 'complete',
    currentIndex: plan.files.length,
    totalFiles: plan.files.length,
    currentLabel: `Ready — ${plan.files.length} PDFs bundled`,
    percent: 100,
  });

  return zipBytes;
}
