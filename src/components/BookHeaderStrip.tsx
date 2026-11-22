import { BookMarked, RotateCcw, Upload } from 'lucide-react';
import type { ArchivePlan, BookDocument, BundleMode } from '../types/pdf';
import { formatByteSize } from '../utils/chapterPlanner';

interface BookHeaderStripProps {
  book: BookDocument;
  archivePlan: ArchivePlan;
  bundleMode: BundleMode;
  isLoadingPdf: boolean;
  onOpenUpload: () => void;
  onRestorePreloadedBook: () => void;
}

const DETECTION_LABELS: Record<BookDocument['detectionMethod'], string> = {
  'verified-catalog': 'Verified chapter catalog',
  'pdf-outline': 'Detected from PDF bookmarks',
  'heading-scan': 'Detected from chapter headings',
  'page-chunks': 'Auto-divided by page range',
};

export function BookHeaderStrip({
  book,
  archivePlan,
  bundleMode,
  isLoadingPdf,
  onOpenUpload,
  onRestorePreloadedBook,
}: BookHeaderStripProps) {
  return (
    <section
      aria-label="Active book summary"
      className="border-b border-[#E4E2DC] bg-white"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-[#525C68]">
              <span className="uppercase tracking-wider text-[#0E4D6B]">
                {book.sourceType === 'preloaded' ? 'Preloaded Textbook' : 'Uploaded PDF'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{DETECTION_LABELS[book.detectionMethod]}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{book.totalPages} PDF pages</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatByteSize(book.fileSizeBytes)}</span>
            </div>

            <h1 className="font-display text-xl font-semibold tracking-tight text-[#14191F] sm:text-2xl">
              {book.title}
              {book.subtitle ? (
                <span className="font-normal text-[#525C68]"> — {book.subtitle}</span>
              ) : null}
            </h1>

            <p className="text-sm text-[#525C68] truncate">
              {[book.authors, book.publisher, book.fileName]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {book.sourceType === 'uploaded' && (
              <button
                type="button"
                onClick={onRestorePreloadedBook}
                disabled={isLoadingPdf}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D8D5CD] bg-white px-3 text-sm font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Load Preloaded Book</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenUpload}
              disabled={isLoadingPdf}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D8D5CD] bg-white px-3 text-sm font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Another PDF</span>
            </button>
          </div>
        </div>

        {/* Structured inline metrics bar with hairline dividers */}
        <div className="mt-4 grid grid-cols-2 gap-y-3 border-t border-[#ECEAE4] pt-3 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-[#ECEAE4]">
          <div className="sm:pr-4">
            <div className="text-xs text-[#6B7480]">PDFs in ZIP</div>
            <div className="mt-0.5 font-mono text-base font-medium text-[#14191F] tabular-nums">
              {archivePlan.totalPdfFiles}{' '}
              <span className="font-sans text-xs font-normal text-[#6B7480]">
                {archivePlan.totalPdfFiles === 1 ? 'file' : 'files'}
              </span>
            </div>
          </div>

          <div className="sm:px-4">
            <div className="text-xs text-[#6B7480]">Selected Pages</div>
            <div className="mt-0.5 font-mono text-base font-medium text-[#14191F] tabular-nums">
              {archivePlan.totalPages}{' '}
              <span className="font-sans text-xs font-normal text-[#6B7480]">
                / {book.totalPages} pp.
              </span>
            </div>
          </div>

          <div className="sm:px-4">
            <div className="text-xs text-[#6B7480]">Bundling Strategy</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[#14191F]">
              <BookMarked className="h-3.5 w-3.5 text-[#0E4D6B] shrink-0" aria-hidden="true" />
              <span className="truncate">
                {bundleMode === 'by-chapter' ? 'Individual Chapters' : 'Merged by Part'}
              </span>
            </div>
          </div>

          <div className="sm:pl-4 min-w-0">
            <div className="text-xs text-[#6B7480]">Output Archive</div>
            <div
              className="mt-0.5 font-mono text-xs font-medium text-[#14191F] truncate"
              title={archivePlan.archiveFileName}
            >
              {archivePlan.archiveFileName}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
