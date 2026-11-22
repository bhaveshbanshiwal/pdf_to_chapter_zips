import type {
  ArchiveFileSpec,
  ArchivePlan,
  ChapterEntry,
  ChapterKind,
  RawOutlineItem,
  ValidationIssue,
  ZipBundleOptions,
} from '../types/pdf';

export function sanitizeFilename(raw: string, fallback = 'section'): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');

  if (!cleaned) return fallback;
  return cleaned.slice(0, 72);
}

export function formatIndexPrefix(index: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return String(index).padStart(width, '0');
}

export function getChapterPageCount(chapter: Pick<ChapterEntry, 'startPage' | 'endPage'>): number {
  if (!Number.isFinite(chapter.startPage) || !Number.isFinite(chapter.endPage)) return 0;
  if (chapter.endPage < chapter.startPage) return 0;
  return chapter.endPage - chapter.startPage + 1;
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function validateChapters(
  chapters: ChapterEntry[],
  totalPages: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const ch of chapters) {
    if (!ch.title.trim()) {
      issues.push({
        chapterId: ch.id,
        severity: 'error',
        message: 'Chapter title cannot be empty.',
      });
    }
    if (!Number.isInteger(ch.startPage) || !Number.isInteger(ch.endPage)) {
      issues.push({
        chapterId: ch.id,
        severity: 'error',
        message: 'Start and end pages must be whole numbers.',
      });
      continue;
    }
    if (ch.startPage < 1 || ch.endPage < 1) {
      issues.push({
        chapterId: ch.id,
        severity: 'error',
        message: 'Page numbers must be at least 1.',
      });
    }
    if (ch.startPage > totalPages || ch.endPage > totalPages) {
      issues.push({
        chapterId: ch.id,
        severity: 'error',
        message: `Page range exceeds document length (${totalPages} pages).`,
      });
    }
    if (ch.startPage > ch.endPage) {
      issues.push({
        chapterId: ch.id,
        severity: 'error',
        message: `Start page (${ch.startPage}) cannot exceed end page (${ch.endPage}).`,
      });
    }
  }

  // Check pairwise overlaps among valid selected chapters
  const validSelected = chapters
    .filter(
      (c) =>
        c.selected &&
        Number.isInteger(c.startPage) &&
        Number.isInteger(c.endPage) &&
        c.startPage >= 1 &&
        c.endPage <= totalPages &&
        c.startPage <= c.endPage
    )
    .sort((a, b) => a.startPage - b.startPage);

  for (let i = 1; i < validSelected.length; i++) {
    const prev = validSelected[i - 1];
    const curr = validSelected[i];
    if (curr.startPage <= prev.endPage) {
      issues.push({
        chapterId: curr.id,
        severity: 'warning',
        message: `Overlaps with "${prev.code} ${prev.title}" (pp. ${prev.startPage}–${prev.endPage}).`,
      });
    }
  }

  return issues;
}

export function buildSingleChapterFileName(
  chapter: ChapterEntry,
  orderIndex?: number,
  totalCount?: number
): string {
  const prefix =
    orderIndex !== undefined && totalCount !== undefined
      ? `${formatIndexPrefix(orderIndex, totalCount)}_`
      : '';
  const codeSlug = chapter.code ? `${sanitizeFilename(chapter.code)}_` : '';
  const titleSlug = sanitizeFilename(chapter.title, 'Chapter');
  return `${prefix}${codeSlug}${titleSlug}.pdf`;
}

export function buildArchivePlan(
  bookTitle: string,
  chapters: ChapterEntry[],
  options: ZipBundleOptions
): ArchivePlan {
  const selected = chapters.filter(
    (c) => c.selected && c.startPage >= 1 && c.endPage >= c.startPage
  );
  const files: ArchiveFileSpec[] = [];
  const usedPaths = new Set<string>();

  const ensureUniquePath = (folder: string | null, fileName: string): { zipPath: string; fileName: string } => {
    const baseName = fileName.replace(/\.pdf$/i, '');
    let candidateName = `${baseName}.pdf`;
    let candidatePath = folder ? `${folder}/${candidateName}` : candidateName;
    let suffix = 2;
    while (usedPaths.has(candidatePath.toLowerCase())) {
      candidateName = `${baseName}_${suffix}.pdf`;
      candidatePath = folder ? `${folder}/${candidateName}` : candidateName;
      suffix++;
    }
    usedPaths.add(candidatePath.toLowerCase());
    return { zipPath: candidatePath, fileName: candidateName };
  };

  if (options.bundleMode === 'by-chapter') {
    // Track distinct parts in order for folder numbering
    const partOrderMap = new Map<string, number>();
    for (const ch of selected) {
      if (!partOrderMap.has(ch.partId)) {
        partOrderMap.set(ch.partId, partOrderMap.size + 1);
      }
    }

    selected.forEach((ch, idx) => {
      const partIdx = partOrderMap.get(ch.partId) ?? 1;
      const folderName =
        options.folderLayout === 'nested-by-part'
          ? `${formatIndexPrefix(partIdx, partOrderMap.size)}_${sanitizeFilename(ch.partTitle, 'Section')}`
          : null;

      const rawFileName = buildSingleChapterFileName(
        ch,
        options.prefixOrderNumbers ? idx + 1 : undefined,
        options.prefixOrderNumbers ? selected.length : undefined
      );
      const { zipPath, fileName } = ensureUniquePath(folderName, rawFileName);
      const pageCount = getChapterPageCount(ch);

      files.push({
        id: ch.id,
        zipPath,
        fileName,
        folderName,
        label: `${ch.code ? `${ch.code} — ` : ''}${ch.title}`,
        partTitle: ch.partTitle,
        sourceChapterIds: [ch.id],
        pageRanges: [{ startPage: ch.startPage, endPage: ch.endPage }],
        pageCount,
      });
    });
  } else {
    // Bundled by Part: one merged PDF per Part containing all selected chapters in that Part
    const partGroups: Array<{
      partId: string;
      partTitle: string;
      partDividerPage?: number;
      chapters: ChapterEntry[];
    }> = [];
    const groupMap = new Map<string, (typeof partGroups)[number]>();

    for (const ch of selected) {
      let group = groupMap.get(ch.partId);
      if (!group) {
        group = {
          partId: ch.partId,
          partTitle: ch.partTitle,
          partDividerPage: ch.partDividerPage,
          chapters: [],
        };
        groupMap.set(ch.partId, group);
        partGroups.push(group);
      }
      group.chapters.push(ch);
    }

    partGroups.forEach((group, idx) => {
      const pageRanges: Array<{ startPage: number; endPage: number }> = [];
      if (options.includePartDividers && group.partDividerPage) {
        pageRanges.push({
          startPage: group.partDividerPage,
          endPage: group.partDividerPage,
        });
      }
      for (const ch of group.chapters) {
        pageRanges.push({ startPage: ch.startPage, endPage: ch.endPage });
      }

      const pageCount = pageRanges.reduce(
        (sum, r) => sum + Math.max(0, r.endPage - r.startPage + 1),
        0
      );
      const prefix = options.prefixOrderNumbers
        ? `${formatIndexPrefix(idx + 1, partGroups.length)}_`
        : '';
      const rawFileName = `${prefix}${sanitizeFilename(group.partTitle, `Part_${idx + 1}`)}.pdf`;
      const { zipPath, fileName } = ensureUniquePath(null, rawFileName);

      files.push({
        id: group.partId,
        zipPath,
        fileName,
        folderName: null,
        label: `${group.partTitle} (${group.chapters.length} ${group.chapters.length === 1 ? 'section' : 'sections'})`,
        partTitle: group.partTitle,
        sourceChapterIds: group.chapters.map((c) => c.id),
        pageRanges,
        pageCount,
      });
    });
  }

  const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0);
  const baseZip = sanitizeFilename(options.archiveName || bookTitle, 'chapters_bundle');
  const archiveFileName = baseZip.toLowerCase().endsWith('.zip') ? baseZip : `${baseZip}.zip`;

  const manifestLines = [
    `${bookTitle} — Chapter PDF Bundle Manifest`,
    `Archive: ${archiveFileName}`,
    `Bundle Mode: ${options.bundleMode === 'by-chapter' ? 'Individual Chapter PDFs' : 'Merged Part PDFs'}`,
    `Files: ${files.length} PDFs · ${totalPages} pages total`,
    '',
    'Contents:',
    ...files.map((f, i) => {
      const rangeStr = f.pageRanges
        .map((r) => (r.startPage === r.endPage ? `p. ${r.startPage}` : `pp. ${r.startPage}-${r.endPage}`))
        .join(', ');
      return `  ${String(i + 1).padStart(2, '0')}. ${f.zipPath}  (${f.pageCount} pp. | PDF ${rangeStr})`;
    }),
    '',
  ];

  return {
    archiveFileName,
    files,
    totalPdfFiles: files.length,
    totalPages,
    manifestContent: manifestLines.join('\n'),
  };
}

export function splitChapterAtPage(
  chapters: ChapterEntry[],
  chapterId: string,
  splitStartPage: number
): ChapterEntry[] {
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index === -1) return chapters;

  const target = chapters[index];
  if (splitStartPage <= target.startPage || splitStartPage > target.endPage) {
    return chapters;
  }

  const firstPart: ChapterEntry = {
    ...target,
    endPage: splitStartPage - 1,
    bookPageLabel: undefined,
  };

  const secondPart: ChapterEntry = {
    ...target,
    id: `${target.id}-split-${splitStartPage}`,
    code: target.code ? `${target.code}b` : 'Part B',
    title: `${target.title} (Continued)`,
    startPage: splitStartPage,
    endPage: target.endPage,
    bookPageLabel: undefined,
  };

  return [
    ...chapters.slice(0, index),
    firstPart,
    secondPart,
    ...chapters.slice(index + 1),
  ];
}

export function mergeChapterWithNext(
  chapters: ChapterEntry[],
  chapterId: string
): ChapterEntry[] {
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index === -1 || index >= chapters.length - 1) return chapters;

  const current = chapters[index];
  const next = chapters[index + 1];

  const merged: ChapterEntry = {
    ...current,
    title: `${current.title} + ${next.title}`,
    startPage: Math.min(current.startPage, next.startPage),
    endPage: Math.max(current.endPage, next.endPage),
    bookPageLabel: undefined,
    selected: current.selected || next.selected,
  };

  return [
    ...chapters.slice(0, index),
    merged,
    ...chapters.slice(index + 2),
  ];
}

export function generateFixedChunkChapters(
  totalPages: number,
  pagesPerChunk: number,
  sectionPrefix = 'Chapter'
): ChapterEntry[] {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeChunk = Math.max(1, Math.min(safeTotal, Math.floor(pagesPerChunk)));
  const results: ChapterEntry[] = [];
  let partCounter = 1;
  let idx = 1;

  for (let start = 1; start <= safeTotal; start += safeChunk) {
    const end = Math.min(safeTotal, start + safeChunk - 1);
    const groupBucket = Math.floor((idx - 1) / 5) + 1;
    partCounter = groupBucket;
    results.push({
      id: `chunk-${idx}`,
      code: `${sectionPrefix.slice(0, 3)}. ${String(idx).padStart(2, '0')}`,
      title: `${sectionPrefix} ${idx} (Pages ${start}–${end})`,
      partId: `part-${partCounter}`,
      partTitle: `Bundle Group ${partCounter}`,
      kind: 'chapter',
      startPage: start,
      endPage: end,
      selected: true,
    });
    idx++;
  }

  return results;
}

function classifyHeadingKind(title: string): ChapterKind {
  const lower = title.toLowerCase();
  if (/^(preface|contents|table of contents|foreword|acknowledg|front matter|cover|title)/.test(lower)) {
    return 'front-matter';
  }
  if (/^appendix\b/.test(lower)) {
    return 'appendix';
  }
  if (/^(bibliography|references|index|glossary|colophon|back matter)/.test(lower)) {
    return 'back-matter';
  }
  return 'chapter';
}

function extractHeadingCode(title: string, fallbackIndex: number): { code: string; cleanTitle: string } {
  const chapterMatch = title.match(/^chapter\s+(\d+|[ivxlcdm]+)\s*[:.\-–—]?\s*(.*)$/i);
  if (chapterMatch) {
    const num = chapterMatch[1].padStart(2, '0');
    return {
      code: `Ch. ${num}`,
      cleanTitle: chapterMatch[2].trim() || `Chapter ${chapterMatch[1]}`,
    };
  }
  const appendixMatch = title.match(/^appendix\s+([a-z0-9]+)\s*[:.\-–—]?\s*(.*)$/i);
  if (appendixMatch) {
    return {
      code: `App. ${appendixMatch[1].toUpperCase()}`,
      cleanTitle: appendixMatch[2].trim() || `Appendix ${appendixMatch[1].toUpperCase()}`,
    };
  }
  const numberedMatch = title.match(/^(\d{1,2})\s*[.:]\s+(.+)$/);
  if (numberedMatch) {
    return {
      code: `Ch. ${numberedMatch[1].padStart(2, '0')}`,
      cleanTitle: numberedMatch[2].trim(),
    };
  }
  const kind = classifyHeadingKind(title);
  if (kind === 'front-matter') return { code: 'Front', cleanTitle: title.trim() };
  if (kind === 'back-matter') return { code: title.trim().slice(0, 6), cleanTitle: title.trim() };
  return { code: `Sec. ${String(fallbackIndex).padStart(2, '0')}`, cleanTitle: title.trim() };
}

export function buildChaptersFromOutlineItems(
  rawItems: RawOutlineItem[],
  totalPages: number
): ChapterEntry[] {
  const valid = rawItems
    .filter((item) => item.title.trim().length > 0 && item.pageNumber >= 1 && item.pageNumber <= totalPages)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  if (valid.length === 0) return [];

  // Identify Part headers vs Chapter entries
  let currentPartId = 'part-1';
  let currentPartTitle = 'Main Chapters';
  let currentPartDivider: number | undefined;
  let partCounter = 1;

  const chapterStarts: Array<{
    title: string;
    startPage: number;
    partId: string;
    partTitle: string;
    partDividerPage?: number;
  }> = [];

  for (const item of valid) {
    const isPartHeading = /^part\s+([ivxlcdm]+|\d+)\b/i.test(item.title.trim());
    if (isPartHeading) {
      partCounter++;
      currentPartId = `part-${partCounter}`;
      currentPartTitle = item.title.trim();
      currentPartDivider = item.pageNumber;
      continue;
    }

    // Avoid duplicate entries on the exact same start page
    const prev = chapterStarts[chapterStarts.length - 1];
    if (prev && prev.startPage === item.pageNumber) {
      continue;
    }

    chapterStarts.push({
      title: item.title.trim(),
      startPage: item.pageNumber,
      partId: currentPartId,
      partTitle: currentPartTitle,
      partDividerPage: currentPartDivider,
    });
  }

  if (chapterStarts.length === 0) return [];

  const entries: ChapterEntry[] = [];

  // Prepend Front Matter if first chapter begins after page 1
  if (chapterStarts[0].startPage > 1) {
    entries.push({
      id: 'auto-front-matter',
      code: 'Front',
      title: 'Front Matter',
      partId: 'part-0',
      partTitle: 'Front Matter',
      kind: 'front-matter',
      startPage: 1,
      endPage: chapterStarts[0].startPage - 1,
      selected: true,
    });
  }

  chapterStarts.forEach((item, idx) => {
    const nextStart = chapterStarts[idx + 1]?.startPage;
    const endPage = nextStart ? Math.max(item.startPage, nextStart - 1) : totalPages;
    const { code, cleanTitle } = extractHeadingCode(item.title, idx + 1);
    const kind = classifyHeadingKind(item.title);

    entries.push({
      id: `auto-ch-${idx + 1}`,
      code,
      title: cleanTitle,
      partId: kind === 'front-matter' ? 'part-0' : item.partId,
      partTitle: kind === 'front-matter' ? 'Front Matter' : item.partTitle,
      partDividerPage: item.partDividerPage,
      kind,
      startPage: item.startPage,
      endPage,
      selected: true,
    });
  });

  return entries;
}

export function detectHeadingFromPageText(
  lines: string[],
  pageNumber: number
): RawOutlineItem | null {
  const topLines = lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .slice(0, 6);

  if (topLines.length === 0) return null;

  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i];
    if (/^part\s+([ivxlcdm]+|\d+)\b/i.test(line) && line.length <= 80) {
      const nextLine = topLines[i + 1];
      const combined =
        nextLine && nextLine.length <= 70 && !/^chapter\b/i.test(nextLine)
          ? `${line}: ${nextLine}`
          : line;
      return { title: combined, pageNumber, level: 0 };
    }
    if (/^chapter\s+(\d+|[ivxlcdm]+)\b/i.test(line) && line.length <= 90) {
      const hasTitleOnSameLine = /^chapter\s+(\d+|[ivxlcdm]+)\s*[:.\-–—]?\s+\S+/i.test(line);
      const nextLine = topLines[i + 1];
      const title =
        !hasTitleOnSameLine && nextLine && nextLine.length <= 80
          ? `${line}: ${nextLine}`
          : line;
      return { title, pageNumber, level: 1 };
    }
    if (/^appendix\s+[a-z0-9]+\b/i.test(line) && line.length <= 85) {
      const hasTitle = /^appendix\s+[a-z0-9]+\s*[:.\-–—]?\s+\S+/i.test(line);
      const nextLine = topLines[i + 1];
      const title = !hasTitle && nextLine && nextLine.length <= 80 ? `${line}: ${nextLine}` : line;
      return { title, pageNumber, level: 1 };
    }
    if (/^(bibliography|references|index)$/i.test(line)) {
      return { title: line, pageNumber, level: 1 };
    }
  }

  return null;
}
