import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  PRELOADED_BOOK_DOCUMENT,
  createPreloadedChapters,
} from '../data/defaultBook';
import {
  buildArchivePlan,
  buildChaptersFromOutlineItems,
  detectHeadingFromPageText,
  formatByteSize,
  generateFixedChunkChapters,
  mergeChapterWithNext,
  sanitizeFilename,
  splitChapterAtPage,
  validateChapters,
} from './chapterPlanner';
import { buildChapterZipBytes, extractSingleChapterPdf } from './pdfBundler';

test('preloaded textbook catalog has 22 valid non-overlapping sections across 765 pages', () => {
  const chapters = createPreloadedChapters();
  assert.equal(chapters.length, 22);
  assert.equal(PRELOADED_BOOK_DOCUMENT.totalPages, 765);

  const issues = validateChapters(chapters, PRELOADED_BOOK_DOCUMENT.totalPages);
  assert.equal(issues.length, 0, `Expected 0 validation issues, got: ${JSON.stringify(issues)}`);

  const ch1 = chapters.find((c) => c.id === 'ch-01');
  assert.ok(ch1);
  assert.equal(ch1.startPage, 26);
  assert.equal(ch1.endPage, 64);

  const indexSection = chapters.find((c) => c.id === 'back-index');
  assert.ok(indexSection);
  assert.equal(indexSection.endPage, 765);
});

test('sanitizeFilename produces safe filesystem names', () => {
  assert.equal(sanitizeFilename('Part II: Linear Programming & Duality'), 'Part_II_Linear_Programming_and_Duality');
  assert.equal(sanitizeFilename('///:::'), 'section');
  assert.equal(formatByteSize(3067904), '2.93 MB');
});

test('validateChapters flags out-of-bounds, inverted ranges, empty titles, and overlaps', () => {
  const chapters = [
    {
      id: 'a',
      code: 'Ch. 01',
      title: 'First',
      partId: 'p1',
      partTitle: 'Part I',
      kind: 'chapter' as const,
      startPage: 1,
      endPage: 10,
      selected: true,
    },
    {
      id: 'b',
      code: 'Ch. 02',
      title: 'Overlapping',
      partId: 'p1',
      partTitle: 'Part I',
      kind: 'chapter' as const,
      startPage: 8,
      endPage: 15,
      selected: true,
    },
    {
      id: 'c',
      code: 'Ch. 03',
      title: '',
      partId: 'p1',
      partTitle: 'Part I',
      kind: 'chapter' as const,
      startPage: 25,
      endPage: 20,
      selected: true,
    },
  ];

  const issues = validateChapters(chapters, 22);
  assert.ok(issues.some((i) => i.chapterId === 'b' && i.severity === 'warning'));
  assert.ok(issues.some((i) => i.chapterId === 'c' && i.message.includes('empty')));
  assert.ok(issues.some((i) => i.chapterId === 'c' && i.message.includes('exceeds document length')));
  assert.ok(issues.some((i) => i.chapterId === 'c' && i.message.includes('cannot exceed end page')));
});

test('buildArchivePlan supports nested-by-part, flat, and merged by-part bundling', () => {
  const chapters = createPreloadedChapters();

  const nestedPlan = buildArchivePlan(PRELOADED_BOOK_DOCUMENT.title, chapters, {
    archiveName: 'Linear_Nonlinear_Optimization',
    bundleMode: 'by-chapter',
    folderLayout: 'nested-by-part',
    includePartDividers: false,
    includeManifest: true,
    prefixOrderNumbers: true,
  });

  assert.equal(nestedPlan.totalPdfFiles, 22);
  assert.equal(nestedPlan.archiveFileName, 'Linear_Nonlinear_Optimization.zip');
  assert.ok(nestedPlan.files[1].zipPath.startsWith('02_Part_I_Basics/02_Ch_01_Optimization_Models'));

  const byPartPlan = buildArchivePlan(PRELOADED_BOOK_DOCUMENT.title, chapters, {
    archiveName: 'Optimization_By_Part',
    bundleMode: 'by-part',
    folderLayout: 'flat',
    includePartDividers: true,
    includeManifest: true,
    prefixOrderNumbers: true,
  });

  // Front Matter + Parts I, II, III, IV, V = 6 merged PDFs
  assert.equal(byPartPlan.totalPdfFiles, 6);
  // Part I includes divider page 24 + Ch 1 (39) + Ch 2 (34) + Ch 3 (17) = 91 pages
  const partI = byPartPlan.files.find((f) => f.id === 'part-1');
  assert.ok(partI);
  assert.equal(partI.pageCount, 91);
});

test('splitChapterAtPage and mergeChapterWithNext transform ranges accurately', () => {
  const initial = generateFixedChunkChapters(30, 10, 'Chapter');
  assert.equal(initial.length, 3);

  const afterSplit = splitChapterAtPage(initial, 'chunk-1', 6);
  assert.equal(afterSplit.length, 4);
  assert.equal(afterSplit[0].startPage, 1);
  assert.equal(afterSplit[0].endPage, 5);
  assert.equal(afterSplit[1].startPage, 6);
  assert.equal(afterSplit[1].endPage, 10);

  const afterMerge = mergeChapterWithNext(afterSplit, 'chunk-1');
  assert.equal(afterMerge.length, 3);
  assert.equal(afterMerge[0].startPage, 1);
  assert.equal(afterMerge[0].endPage, 10);
});

test('outline & heading detection builds contiguous chapters with front matter', () => {
  const detected = detectHeadingFromPageText(['Chapter 2', 'Linear Duality', 'Body text'], 15);
  assert.deepEqual(detected, {
    title: 'Chapter 2: Linear Duality',
    pageNumber: 15,
    level: 1,
  });

  const chapters = buildChaptersFromOutlineItems(
    [
      { title: 'Part I: Foundations', pageNumber: 5, level: 0 },
      { title: 'Chapter 1: Models', pageNumber: 6, level: 1 },
      { title: 'Chapter 2: Algorithms', pageNumber: 20, level: 1 },
    ],
    35
  );

  assert.equal(chapters.length, 3); // Front Matter (1-5), Ch 1 (6-19), Ch 2 (20-35)
  assert.equal(chapters[0].kind, 'front-matter');
  assert.equal(chapters[0].endPage, 5);
  assert.equal(chapters[1].code, 'Ch. 01');
  assert.equal(chapters[1].endPage, 19);
  assert.equal(chapters[2].code, 'Ch. 02');
  assert.equal(chapters[2].endPage, 35);
});

test('end-to-end pdf-lib split and jszip archive round-trip produces valid PDFs inside ZIP', async () => {
  // Create a real 12-page PDF in memory
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 12; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Synthetic Textbook Page ${i}`, { x: 40, y: 520, size: 16, font });
  }
  const sourceBytes = await doc.save();

  const chapters = [
    {
      id: 'ch-1',
      code: 'Ch. 01',
      title: 'Introduction',
      partId: 'p1',
      partTitle: 'Part I Basics',
      kind: 'chapter' as const,
      startPage: 1,
      endPage: 4,
      selected: true,
    },
    {
      id: 'ch-2',
      code: 'Ch. 02',
      title: 'Simplex Method',
      partId: 'p1',
      partTitle: 'Part I Basics',
      kind: 'chapter' as const,
      startPage: 5,
      endPage: 9,
      selected: true,
    },
    {
      id: 'ch-3',
      code: 'Ch. 03',
      title: 'Nonlinear Methods',
      partId: 'p2',
      partTitle: 'Part II Nonlinear',
      kind: 'chapter' as const,
      startPage: 10,
      endPage: 12,
      selected: true,
    },
  ];

  // Test single chapter extraction
  const ch2Bytes = await extractSingleChapterPdf(sourceBytes, chapters[1], 'Synthetic Book');
  const ch2Loaded = await PDFDocument.load(ch2Bytes);
  assert.equal(ch2Loaded.getPageCount(), 5);

  // Test full ZIP archive bundling
  const plan = buildArchivePlan('Synthetic Book', chapters, {
    archiveName: 'synthetic_chapters',
    bundleMode: 'by-chapter',
    folderLayout: 'nested-by-part',
    includePartDividers: false,
    includeManifest: true,
    prefixOrderNumbers: true,
  });

  const zipBytes = await buildChapterZipBytes(sourceBytes, plan, true, 'Synthetic Book');
  const loadedZip = await JSZip.loadAsync(zipBytes);

  // Verify manifest exists
  const manifest = await loadedZip.file('MANIFEST.txt')?.async('string');
  assert.ok(manifest && manifest.includes('Synthetic Book'));

  // Verify every planned PDF exists and has exact page count
  for (const spec of plan.files) {
    const zipEntry = loadedZip.file(spec.zipPath);
    assert.ok(zipEntry, `Missing expected ZIP entry: ${spec.zipPath}`);
    const extractedPdfBytes = await zipEntry.async('uint8array');
    const extractedDoc = await PDFDocument.load(extractedPdfBytes);
    assert.equal(extractedDoc.getPageCount(), spec.pageCount);
  }
});
