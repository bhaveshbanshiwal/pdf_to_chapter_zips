import { useRef, useState } from 'react';
import { AlertCircle, BookOpen, FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { PRELOADED_BOOK_DOCUMENT } from '../data/defaultBook';
import { formatByteSize } from '../utils/chapterPlanner';

interface UploadPanelProps {
  isAnalyzing: boolean;
  errorMessage: string | null;
  activeBookId: string;
  onFileSelected: (file: File) => void;
  onSelectPreloadedBook: () => void;
}

export function UploadPanel({
  isAnalyzing,
  errorMessage,
  activeBookId,
  onFileSelected,
  onSelectPreloadedBook,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border border-[#E4E2DC] bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-[#14191F]">
          Upload a PDF Book or Document
        </h2>
        <p className="mt-1 text-sm text-[#525C68]">
          FolioSplit inspects embedded PDF bookmarks first, scans for chapter and appendix
          headings second, and lets you fine-tune every page boundary before bundling into a ZIP.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
            isDragOver
              ? 'border-[#0E4D6B] bg-[#EEF5F8]'
              : 'border-[#D4D1C8] bg-[#FAF9F6] hover:border-[#9CA6B0]'
          }`}
        >
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#0E4D6B]" aria-hidden="true" />
              <div className="text-sm font-medium text-[#14191F]">
                Inspecting PDF structure &amp; detecting chapters…
              </div>
              <p className="text-xs text-[#6B7480]">
                Reading page count, bookmarks, and section headings locally in your browser.
              </p>
            </div>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#E4E2DC] bg-white text-[#0E4D6B]">
                <FileUp className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#14191F]">
                Drop a PDF file here, or browse from your device
              </p>
              <p className="mt-1 text-xs text-[#6B7480]">
                Supports textbooks, manuals, theses, and reports (.pdf)
              </p>

              <input
                ref={inputRef}
                id="pdf-upload-input"
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Choose a PDF file to split into chapters"
                className="sr-only"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-[#0E4D6B] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0A3B52] whitespace-nowrap cursor-pointer"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                <span>Choose PDF File</span>
              </button>
            </>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-md border border-[#F5C2C0] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#991B1B]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-[#6B7480]">
          <ShieldCheck className="h-4 w-4 text-[#15803D] shrink-0" aria-hidden="true" />
          <span>
            Local processing: PDF splitting and ZIP compression run directly in your browser without uploading files to external servers.
          </span>
        </div>
      </div>

      {/* Preloaded Book Quick-Load Row */}
      <div className="rounded-lg border border-[#E4E2DC] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E4E2DC] bg-[#F7F6F3] text-[#0E4D6B] shrink-0">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-[#0E4D6B]">
                Preloaded Book
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold text-[#14191F]">
                {PRELOADED_BOOK_DOCUMENT.title} ({PRELOADED_BOOK_DOCUMENT.subtitle})
              </h3>
              <p className="mt-0.5 text-xs text-[#525C68]">
                {PRELOADED_BOOK_DOCUMENT.authors} · {PRELOADED_BOOK_DOCUMENT.publisher} ·{' '}
                <span className="font-mono tabular-nums">
                  {PRELOADED_BOOK_DOCUMENT.totalPages} pp.
                </span>{' '}
                ·{' '}
                <span className="font-mono tabular-nums">
                  {formatByteSize(PRELOADED_BOOK_DOCUMENT.fileSizeBytes)}
                </span>{' '}
                · 16 chapters across 5 parts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelectPreloadedBook}
            disabled={isAnalyzing}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#D8D5CD] bg-white px-3.5 text-sm font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeBookId === PRELOADED_BOOK_DOCUMENT.id
              ? 'Open Chapter Editor'
              : 'Load Preloaded Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
