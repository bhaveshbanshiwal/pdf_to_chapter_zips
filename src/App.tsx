import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ArchivePreviewPane } from './components/ArchivePreviewPane';
import { BookHeaderStrip } from './components/BookHeaderStrip';
import { ChapterEditorTable } from './components/ChapterEditorTable';
import { InspectorSidebar } from './components/InspectorSidebar';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { UploadPanel } from './components/UploadPanel';
import {
  PRELOADED_BOOK_ASSET_URL,
  PRELOADED_BOOK_DOCUMENT,
  createPreloadedChapters,
} from './data/defaultBook';
import type {
  ArchiveFileSpec,
  BookDocument,
  ChapterEntry,
  ExportProgress,
  ExportResult,
  ZipBundleOptions,
} from './types/pdf';
import {
  buildArchivePlan,
  buildSingleChapterFileName,
  generateFixedChunkChapters,
  mergeChapterWithNext,
  sanitizeFilename,
  splitChapterAtPage,
  validateChapters,
} from './utils/chapterPlanner';
import {
  type PdfPreviewProxy,
  analyzeUploadedPdf,
  openPdfPreviewHandle,
} from './utils/pdfBrowserInspector';
import {
  buildChapterZipBytes,
  extractRangesToPdfBytes,
  extractSingleChapterPdf,
} from './utils/pdfBundler';

function triggerBlobDownload(bytes: Uint8Array, mimeType: string, fileName: string): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return url;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chapters');
  const [book, setBook] = useState<BookDocument>(PRELOADED_BOOK_DOCUMENT);
  const [chapters, setChapters] = useState<ChapterEntry[]>(() => createPreloadedChapters());
  const [activeChapterId, setActiveChapterId] = useState<string | null>('ch-01');

  const [bundleOptions, setBundleOptions] = useState<ZipBundleOptions>({
    archiveName: 'Linear_and_Nonlinear_Optimization_Chapters',
    bundleMode: 'by-chapter',
    folderLayout: 'nested-by-part',
    includePartDividers: true,
    includeManifest: true,
    prefixOrderNumbers: true,
  });

  // Binary PDF buffer & pdfjs preview handle
  const sourceBytesRef = useRef<Uint8Array | null>(null);
  const [hasSourceBytes, setHasSourceBytes] = useState(false);
  const [previewProxy, setPreviewProxy] = useState<PdfPreviewProxy | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadingChapterId, setDownloadingChapterId] = useState<string | null>(null);

  const previewProxyRef = useRef<PdfPreviewProxy | null>(null);
  const exportUrlRef = useRef<string | null>(null);

  const disposePreviewProxy = useCallback((proxy: PdfPreviewProxy | null) => {
    if (!proxy) return;
    try {
      void Promise.resolve(proxy.cleanup()).catch(() => {});
    } catch {
      // Ignore cleanup errors on proxy disposal
    }
  }, []);

  const replacePreviewProxy = useCallback(
    (nextProxy: PdfPreviewProxy | null) => {
      const prev = previewProxyRef.current;
      previewProxyRef.current = nextProxy;
      setPreviewProxy(nextProxy);
      if (prev && prev !== nextProxy) {
        disposePreviewProxy(prev);
      }
    },
    [disposePreviewProxy]
  );

  const clearPreviousExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportResult(null);
    setExportError(null);
    setExportProgress(null);
  }, []);

  const loadPreloadedBook = useCallback(async () => {
    setIsLoadingPdf(true);
    setPdfLoadError(null);
    setUploadError(null);
    clearPreviousExport();

    const preloadedChapters = createPreloadedChapters();
    setBook(PRELOADED_BOOK_DOCUMENT);
    setChapters(preloadedChapters);
    setActiveChapterId('ch-01');
    setBundleOptions((prev) => ({
      ...prev,
      archiveName: 'Linear_and_Nonlinear_Optimization_Chapters',
    }));

    try {
      const response = await fetch(PRELOADED_BOOK_ASSET_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch preloaded textbook (HTTP ${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      sourceBytesRef.current = bytes;
      setHasSourceBytes(true);

      const proxy = await openPdfPreviewHandle(bytes);
      replacePreviewProxy(proxy);
      setBook((prev) => ({
        ...prev,
        totalPages: proxy.numPages,
        fileSizeBytes: bytes.byteLength,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load the preloaded PDF file.';
      setPdfLoadError(msg);
      sourceBytesRef.current = null;
      setHasSourceBytes(false);
    } finally {
      setIsLoadingPdf(false);
    }
  }, [clearPreviousExport, replacePreviewProxy]);

  useEffect(() => {
    loadPreloadedBook();
    return () => {
      disposePreviewProxy(previewProxyRef.current);
      if (exportUrlRef.current) {
        URL.revokeObjectURL(exportUrlRef.current);
      }
    };
  }, [loadPreloadedBook, disposePreviewProxy]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setUploadError('Please select a valid PDF document (.pdf).');
        return;
      }

      setIsLoadingPdf(true);
      setPdfLoadError(null);
      clearPreviousExport();

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const { book: analyzedBook, chapters: detectedChapters, previewProxy: nextProxy } =
          await analyzeUploadedPdf(bytes, file.name, file.size);

        sourceBytesRef.current = bytes;
        setHasSourceBytes(true);
        replacePreviewProxy(nextProxy);
        setBook(analyzedBook);
        setChapters(detectedChapters);
        setActiveChapterId(detectedChapters[0]?.id ?? null);
        setBundleOptions((prev) => ({
          ...prev,
          archiveName: `${sanitizeFilename(analyzedBook.title, 'PDF_Book')}_Chapters`,
        }));
        setActiveTab('chapters');
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not read this PDF file. Please verify it is not corrupted or password-locked.';
        setUploadError(msg);
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [clearPreviousExport, replacePreviewProxy]
  );

  // Derived validation & archive plan
  const validationIssues = useMemo(
    () => validateChapters(chapters, book.totalPages),
    [chapters, book.totalPages]
  );

  const hasValidationErrors = useMemo(
    () => validationIssues.some((i) => i.severity === 'error'),
    [validationIssues]
  );

  const archivePlan = useMemo(
    () => buildArchivePlan(book.title, chapters, bundleOptions),
    [book.title, chapters, bundleOptions]
  );

  const activeChapter = useMemo(() => {
    if (!activeChapterId) return chapters[0] ?? null;
    return chapters.find((c) => c.id === activeChapterId) ?? chapters[0] ?? null;
  }, [activeChapterId, chapters]);

  const hasPartDividers = useMemo(
    () => chapters.some((c) => typeof c.partDividerPage === 'number'),
    [chapters]
  );

  const canExport =
    hasSourceBytes && !isLoadingPdf && !hasValidationErrors && archivePlan.totalPdfFiles > 0;

  // Chapter editing handlers
  const handleToggleChapterSelected = (chapterId: string) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleTogglePartSelected = (partId: string, selected: boolean) => {
    setChapters((prev) =>
      prev.map((c) => (c.partId === partId ? { ...c, selected } : c))
    );
  };

  const handleSelectPreset = (preset: 'all' | 'chapters-only' | 'none') => {
    setChapters((prev) =>
      prev.map((c) => {
        if (preset === 'all') return { ...c, selected: true };
        if (preset === 'none') return { ...c, selected: false };
        return { ...c, selected: c.kind === 'chapter' };
      })
    );
  };

  const handleUpdateChapter = (
    chapterId: string,
    patch: Partial<Pick<ChapterEntry, 'title' | 'startPage' | 'endPage' | 'code'>>
  ) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, ...patch } : c))
    );
  };

  const handleAddChapter = () => {
    const last = chapters[chapters.length - 1];
    const nextStart = last ? Math.min(book.totalPages, last.endPage + 1) : 1;
    const nextEnd = Math.min(book.totalPages, nextStart + 19);
    const nextIdx = chapters.length + 1;
    const newId = `custom-${Date.now()}`;

    const newChapter: ChapterEntry = {
      id: newId,
      code: `Sec. ${String(nextIdx).padStart(2, '0')}`,
      title: `Custom Section ${nextIdx}`,
      partId: last?.partId ?? 'part-custom',
      partTitle: last?.partTitle ?? 'Custom Sections',
      kind: 'chapter',
      startPage: nextStart,
      endPage: Math.max(nextStart, nextEnd),
      selected: true,
    };

    setChapters((prev) => [...prev, newChapter]);
    setActiveChapterId(newId);
  };

  const handleDeleteChapter = (chapterId: string) => {
    setChapters((prev) => {
      const next = prev.filter((c) => c.id !== chapterId);
      if (activeChapterId === chapterId) {
        setActiveChapterId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleSplitChapter = (chapterId: string, splitPage: number) => {
    setChapters((prev) => splitChapterAtPage(prev, chapterId, splitPage));
  };

  const handleMergeWithNext = (chapterId: string) => {
    setChapters((prev) => mergeChapterWithNext(prev, chapterId));
  };

  const handleAutoSplitByPages = (pagesPerChunk: number) => {
    const next = generateFixedChunkChapters(book.totalPages, pagesPerChunk, 'Chapter');
    setChapters(next);
    setActiveChapterId(next[0]?.id ?? null);
  };

  const handleResetPreloadedMap = () => {
    const fresh = createPreloadedChapters();
    setChapters(fresh);
    setActiveChapterId('ch-01');
  };

  // Single chapter or archive spec download
  const handleDownloadSingleChapter = async (chapter: ChapterEntry) => {
    const bytes = sourceBytesRef.current;
    if (!bytes) return;
    setDownloadingChapterId(chapter.id);
    setExportError(null);
    try {
      const pdfBytes = await extractSingleChapterPdf(bytes, chapter, book.title);
      const fileName = buildSingleChapterFileName(chapter);
      const url = triggerBlobDownload(pdfBytes, 'application/pdf', fileName);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to extract chapter PDF.'
      );
    } finally {
      setDownloadingChapterId(null);
    }
  };

  const handleDownloadSingleSpec = async (spec: ArchiveFileSpec) => {
    const bytes = sourceBytesRef.current;
    if (!bytes) return;
    setDownloadingChapterId(spec.id);
    setExportError(null);
    try {
      const sourceDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pdfBytes = await extractRangesToPdfBytes(sourceDoc, spec.pageRanges, {
        title: spec.label,
        subject: `${book.title} — ${spec.partTitle}`,
      });
      const url = triggerBlobDownload(pdfBytes, 'application/pdf', spec.fileName);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to extract PDF bundle.'
      );
    } finally {
      setDownloadingChapterId(null);
    }
  };

  // Full ZIP export
  const handleExportZip = async () => {
    const bytes = sourceBytesRef.current;
    if (!bytes || !canExport || isExporting) return;

    clearPreviousExport();
    setIsExporting(true);

    try {
      const zipBytes = await buildChapterZipBytes(
        bytes,
        archivePlan,
        bundleOptions.includeManifest,
        book.title,
        (progress) => setExportProgress(progress)
      );

      const url = triggerBlobDownload(
        zipBytes,
        'application/zip',
        archivePlan.archiveFileName
      );
      exportUrlRef.current = url;
      setExportResult({
        blobUrl: url,
        fileName: archivePlan.archiveFileName,
        byteSize: zipBytes.byteLength,
        fileCount: archivePlan.totalPdfFiles,
        totalPages: archivePlan.totalPages,
        createdAt: Date.now(),
      });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to generate ZIP archive.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#14191F]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedPdfCount={archivePlan.totalPdfFiles}
        canExport={canExport}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onExportZip={handleExportZip}
      />

      <BookHeaderStrip
        book={book}
        archivePlan={archivePlan}
        bundleMode={bundleOptions.bundleMode}
        isLoadingPdf={isLoadingPdf}
        onOpenUpload={() => setActiveTab('upload')}
        onRestorePreloadedBook={() => {
          loadPreloadedBook();
          setActiveTab('chapters');
        }}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {activeTab === 'upload' ? (
          <UploadPanel
            isAnalyzing={isLoadingPdf}
            errorMessage={uploadError}
            activeBookId={book.id}
            onFileSelected={handleFileUpload}
            onSelectPreloadedBook={() => {
              if (book.id !== PRELOADED_BOOK_DOCUMENT.id) {
                loadPreloadedBook();
              }
              setActiveTab('chapters');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">
            <div className="min-w-0">
              {activeTab === 'chapters' ? (
                <ChapterEditorTable
                  chapters={chapters}
                  totalPages={book.totalPages}
                  bundleMode={bundleOptions.bundleMode}
                  activeChapterId={activeChapter?.id ?? null}
                  issues={validationIssues}
                  isPreloadedBook={book.sourceType === 'preloaded'}
                  downloadingChapterId={downloadingChapterId}
                  onBundleModeChange={(mode) =>
                    setBundleOptions((prev) => ({ ...prev, bundleMode: mode }))
                  }
                  onSelectChapterForPreview={setActiveChapterId}
                  onToggleChapterSelected={handleToggleChapterSelected}
                  onTogglePartSelected={handleTogglePartSelected}
                  onSelectPreset={handleSelectPreset}
                  onUpdateChapter={handleUpdateChapter}
                  onAddChapter={handleAddChapter}
                  onDeleteChapter={handleDeleteChapter}
                  onSplitChapter={handleSplitChapter}
                  onMergeWithNext={handleMergeWithNext}
                  onAutoSplitByPages={handleAutoSplitByPages}
                  onResetPreloadedMap={handleResetPreloadedMap}
                  onDownloadSingleChapter={handleDownloadSingleChapter}
                />
              ) : (
                <ArchivePreviewPane
                  plan={archivePlan}
                  options={bundleOptions}
                  downloadingFileId={downloadingChapterId}
                  onDownloadSingleSpec={handleDownloadSingleSpec}
                  onExportZip={handleExportZip}
                  isExporting={isExporting}
                  canExport={canExport}
                />
              )}
            </div>

            <InspectorSidebar
              previewProxy={previewProxy}
              isLoadingPdf={isLoadingPdf}
              pdfLoadError={pdfLoadError}
              activeChapter={activeChapter}
              totalPages={book.totalPages}
              hasPartDividers={hasPartDividers}
              options={bundleOptions}
              archivePlan={archivePlan}
              canExport={canExport}
              isExporting={isExporting}
              exportProgress={exportProgress}
              exportResult={exportResult}
              exportError={exportError}
              downloadingChapterId={downloadingChapterId}
              onOptionsChange={(patch) =>
                setBundleOptions((prev) => ({ ...prev, ...patch }))
              }
              onExportZip={handleExportZip}
              onDownloadSingleChapter={handleDownloadSingleChapter}
              onSplitAtCurrentPage={handleSplitChapter}
            />
          </div>
        )}
      </main>
    </div>
  );
}
