import { useEffect, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist/types/src/display/api';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Loader2,
  Scissors,
} from 'lucide-react';
import type {
  ArchivePlan,
  ChapterEntry,
  ExportProgress,
  ExportResult,
  ZipBundleOptions,
} from '../types/pdf';
import { formatByteSize, getChapterPageCount } from '../utils/chapterPlanner';
import { type PdfPreviewProxy, renderPdfPageToCanvas } from '../utils/pdfBrowserInspector';

interface InspectorSidebarProps {
  previewProxy: PdfPreviewProxy | null;
  isLoadingPdf: boolean;
  pdfLoadError: string | null;
  activeChapter: ChapterEntry | null;
  totalPages: number;
  hasPartDividers: boolean;
  options: ZipBundleOptions;
  archivePlan: ArchivePlan;
  canExport: boolean;
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportResult: ExportResult | null;
  exportError: string | null;
  downloadingChapterId: string | null;
  onOptionsChange: (patch: Partial<ZipBundleOptions>) => void;
  onExportZip: () => void;
  onDownloadSingleChapter: (chapter: ChapterEntry) => void;
  onSplitAtCurrentPage: (chapterId: string, splitPage: number) => void;
}

export function InspectorSidebar({
  previewProxy,
  isLoadingPdf,
  pdfLoadError,
  activeChapter,
  totalPages,
  hasPartDividers,
  options,
  archivePlan,
  canExport,
  isExporting,
  exportProgress,
  exportResult,
  exportError,
  downloadingChapterId,
  onOptionsChange,
  onExportZip,
  onDownloadSingleChapter,
  onSplitAtCurrentPage,
}: InspectorSidebarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(activeChapter?.startPage ?? 1);
  const [isRenderingPage, setIsRenderingPage] = useState(false);

  // Snap preview page to start of chapter when user switches chapter
  useEffect(() => {
    if (activeChapter) {
      const clamped = Math.max(1, Math.min(totalPages, activeChapter.startPage));
      setPreviewPage(clamped);
    }
  }, [activeChapter?.id, activeChapter?.startPage, totalPages]);

  // Render real PDF page on canvas whenever proxy or page number changes
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!previewProxy || !canvas) return;

    setIsRenderingPage(true);
    renderPdfPageToCanvas(previewProxy, previewPage, canvas, 248, renderTaskRef)
      .then(() => {
        if (!cancelled) setIsRenderingPage(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // Ignore cancellation errors triggered when stepping pages rapidly
        if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
          return;
        }
        setIsRenderingPage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewProxy, previewPage]);

  const chapterStart = activeChapter ? Math.max(1, Math.min(totalPages, activeChapter.startPage)) : 1;
  const chapterEnd = activeChapter
    ? Math.max(chapterStart, Math.min(totalPages, activeChapter.endPage))
    : totalPages;
  const chapterPageCount = activeChapter ? getChapterPageCount(activeChapter) : 0;
  const canSplitHere =
    activeChapter !== null &&
    previewPage > activeChapter.startPage &&
    previewPage <= activeChapter.endPage;

  return (
    <aside
      aria-label="Page preview and ZIP export settings"
      className="space-y-4 lg:sticky lg:top-[72px] lg:self-start"
    >
      {/* Panel 1: Live PDF Page Preview */}
      <div className="rounded-lg border border-[#E4E2DC] bg-white">
        <div className="flex items-start justify-between gap-2 border-b border-[#ECEAE4] px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#0E4D6B]">
              Page Inspector
            </div>
            <h2 className="mt-0.5 font-display text-sm font-semibold text-[#14191F] truncate">
              {activeChapter ? `${activeChapter.code} · ${activeChapter.title}` : 'Select a chapter'}
            </h2>
            {activeChapter && (
              <p className="mt-0.5 font-mono text-[11px] text-[#6B7480] tabular-nums">
                PDF pp. {activeChapter.startPage}–{activeChapter.endPage} ({chapterPageCount} pp.)
              </p>
            )}
          </div>

          {activeChapter && (
            <button
              type="button"
              onClick={() => onDownloadSingleChapter(activeChapter)}
              disabled={downloadingChapterId === activeChapter.id || chapterPageCount === 0}
              aria-label={`Download ${activeChapter.code} PDF`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D8D5CD] bg-white px-2.5 text-xs font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {downloadingChapterId === activeChapter.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>PDF</span>
            </button>
          )}
        </div>

        {/* Canvas Viewport */}
        <div className="flex flex-col items-center bg-[#EFECE6] px-4 py-3">
          <div
            data-testid="pdf-preview-frame"
            className="relative flex min-h-[290px] w-full max-w-[248px] items-center justify-center overflow-hidden rounded border border-[#D9D5CC] bg-white shadow-xs"
          >
            {pdfLoadError ? (
              <div className="p-6 text-center text-xs text-[#991B1B]">{pdfLoadError}</div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  data-testid="pdf-preview-canvas"
                  aria-label={`Preview of PDF page ${previewPage}`}
                  className="block max-w-full h-auto"
                />
                {(isLoadingPdf || isRenderingPage || !previewProxy) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85">
                    <Loader2 className="h-5 w-5 animate-spin text-[#0E4D6B]" aria-hidden="true" />
                    <span className="text-xs text-[#525C68]">
                      {isLoadingPdf ? 'Loading PDF book…' : `Rendering page ${previewPage}…`}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Page Stepper */}
          <div className="mt-2.5 flex w-full max-w-[336px] items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewPage(chapterStart)}
                disabled={previewPage <= chapterStart}
                aria-label="Jump to first page of chapter"
                className="h-7 rounded border border-[#D8D5CD] bg-white px-2 text-[11px] font-medium text-[#14191F] hover:bg-[#F7F6F3] disabled:opacity-40 cursor-pointer"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                aria-label="Previous PDF page"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D8D5CD] bg-white text-[#14191F] hover:bg-[#F7F6F3] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="font-mono text-xs text-[#14191F] tabular-nums">
              PDF p. {previewPage}{' '}
              <span className="text-[#6B7480]">/ {totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                disabled={previewPage >= totalPages}
                aria-label="Next PDF page"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D8D5CD] bg-white text-[#14191F] hover:bg-[#F7F6F3] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewPage(chapterEnd)}
                disabled={previewPage >= chapterEnd}
                aria-label="Jump to last page of chapter"
                className="h-7 rounded border border-[#D8D5CD] bg-white px-2 text-[11px] font-medium text-[#14191F] hover:bg-[#F7F6F3] disabled:opacity-40 cursor-pointer"
              >
                End
              </button>
            </div>
          </div>

          {canSplitHere && activeChapter && (
            <button
              type="button"
              onClick={() => onSplitAtCurrentPage(activeChapter.id, previewPage)}
              className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded border border-[#C7DAE3] bg-[#EEF5F8] px-2.5 text-xs font-medium text-[#0E4D6B] hover:bg-[#E1EEF4] cursor-pointer"
            >
              <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Split chapter starting at page {previewPage}</span>
            </button>
          )}
        </div>
      </div>

      {/* Panel 2: ZIP Export Configuration */}
      <div className="rounded-lg border border-[#E4E2DC] bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#ECEAE4] pb-3">
          <FileArchive className="h-4 w-4 text-[#0E4D6B]" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-[#14191F]">
            ZIP Bundle Configuration
          </h2>
        </div>

        <div className="space-y-3">
          {/* Archive Name */}
          <div>
            <label
              htmlFor="zip-archive-name"
              className="block text-xs font-medium text-[#374151]"
            >
              ZIP Filename
            </label>
            <div className="mt-1 flex items-center">
              <input
                id="zip-archive-name"
                type="text"
                value={options.archiveName}
                onChange={(e) => onOptionsChange({ archiveName: e.target.value })}
                className="h-8 w-full rounded-l-md border border-r-0 border-[#D8D5CD] bg-[#FAF9F6] px-2.5 font-mono text-xs text-[#14191F] focus:border-[#0E4D6B] focus:bg-white focus:outline-none"
              />
              <span className="inline-flex h-8 items-center rounded-r-md border border-[#D8D5CD] bg-[#EFECE6] px-2 font-mono text-xs text-[#525C68]">
                .zip
              </span>
            </div>
          </div>

          {/* Folder Structure (only relevant when bundling by chapter) */}
          {options.bundleMode === 'by-chapter' && (
            <div>
              <div className="text-xs font-medium text-[#374151]">Folder Structure</div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onOptionsChange({ folderLayout: 'nested-by-part' })}
                  aria-pressed={options.folderLayout === 'nested-by-part'}
                  className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    options.folderLayout === 'nested-by-part'
                      ? 'border-[#0E4D6B] bg-[#EEF5F8] text-[#0E4D6B]'
                      : 'border-[#D8D5CD] bg-white text-[#525C68] hover:text-[#14191F]'
                  }`}
                >
                  Part Folders
                </button>
                <button
                  type="button"
                  onClick={() => onOptionsChange({ folderLayout: 'flat' })}
                  aria-pressed={options.folderLayout === 'flat'}
                  className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    options.folderLayout === 'flat'
                      ? 'border-[#0E4D6B] bg-[#EEF5F8] text-[#0E4D6B]'
                      : 'border-[#D8D5CD] bg-white text-[#525C68] hover:text-[#14191F]'
                  }`}
                >
                  Flat Directory
                </button>
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-2 pt-0.5">
            <label className="flex items-center gap-2 text-xs text-[#14191F] cursor-pointer">
              <input
                type="checkbox"
                checked={options.prefixOrderNumbers}
                onChange={(e) =>
                  onOptionsChange({ prefixOrderNumbers: e.target.checked })
                }
                className="h-4 w-4 rounded border-[#C2C7CE] accent-[#0E4D6B]"
              />
              <span>Prefix filenames with order numbers (01_, 02_…)</span>
            </label>

            {options.bundleMode === 'by-part' && hasPartDividers && (
              <label className="flex items-center gap-2 text-xs text-[#14191F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includePartDividers}
                  onChange={(e) =>
                    onOptionsChange({ includePartDividers: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-[#C2C7CE] accent-[#0E4D6B]"
                />
                <span>Include Part title divider page in each Part PDF</span>
              </label>
            )}

            <label className="flex items-center gap-2 text-xs text-[#14191F] cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeManifest}
                onChange={(e) => onOptionsChange({ includeManifest: e.target.checked })}
                className="h-4 w-4 rounded border-[#C2C7CE] accent-[#0E4D6B]"
              />
              <span>Include MANIFEST.txt chapter index</span>
            </label>
          </div>
        </div>

        {/* Export Progress Bar */}
        {isExporting && exportProgress && (
          <div className="space-y-1.5 rounded-md border border-[#D4E2EA] bg-[#F3F8FA] p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[#0E4D6B] truncate">
                {exportProgress.currentLabel}
              </span>
              <span className="font-mono text-[#0E4D6B] tabular-nums shrink-0">
                {exportProgress.percent}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#D8E5EC]">
              <div
                className="h-full bg-[#0E4D6B] transition-all duration-150"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
            <div className="font-mono text-[11px] text-[#525C68] tabular-nums">
              {exportProgress.currentIndex} / {exportProgress.totalFiles} PDF bundles processed
            </div>
          </div>
        )}

        {/* Export Error */}
        {exportError && (
          <div
            role="alert"
            className="rounded-md border border-[#F5C2C0] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
          >
            {exportError}
          </div>
        )}

        {/* Primary Export Button */}
        <button
          type="button"
          onClick={onExportZip}
          disabled={!canExport || isExporting}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0E4D6B] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0A3B52] disabled:cursor-not-allowed disabled:bg-[#C6CCD2] cursor-pointer"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Building Chapter ZIP…</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>
                Export &amp; Download ZIP ({archivePlan.totalPdfFiles}{' '}
                {archivePlan.totalPdfFiles === 1 ? 'PDF' : 'PDFs'})
              </span>
            </>
          )}
        </button>

        {/* Completed Download Confirmation */}
        {exportResult && !isExporting && (
          <div
            data-testid="export-complete-banner"
            className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 text-[#15803D] shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[#166534]">
                  ZIP bundle downloaded
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[#15803D] break-all tabular-nums">
                  {exportResult.fileName} · {exportResult.fileCount} PDFs ·{' '}
                  {exportResult.totalPages} pp. · {formatByteSize(exportResult.byteSize)}
                </div>
                <a
                  href={exportResult.blobUrl}
                  download={exportResult.fileName}
                  className="mt-2 inline-flex items-center gap-1 font-medium text-[#14532D] underline underline-offset-2 hover:text-[#052E16]"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>Save ZIP again</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
