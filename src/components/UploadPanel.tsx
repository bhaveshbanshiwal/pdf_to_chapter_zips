import { useRef, useState } from 'react';
import {
  AlertCircle,
  FileUp,
  FolderArchive,
  Layers,
  Loader2,
  Scissors,
  ShieldCheck,
} from 'lucide-react';

interface UploadPanelProps {
  isAnalyzing: boolean;
  errorMessage: string | null;
  hasActiveBook: boolean;
  activeBookTitle?: string;
  onFileSelected: (file: File) => void;
  onReturnToEditor?: () => void;
}

export function UploadPanel({
  isAnalyzing,
  errorMessage,
  hasActiveBook,
  activeBookTitle,
  onFileSelected,
  onReturnToEditor,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <div className="rounded-lg border border-[#E4E2DC] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#14191F]">
              Split a PDF into Chapter Bundles
            </h1>
            <p className="mt-1.5 text-sm text-[#525C68]">
              Upload any textbook, manual, or report. FolioSplit detects chapters from embedded
              bookmarks or page headings, lets you preview and edit every page range, and exports a
              structured ZIP archive.
            </p>
          </div>

          {hasActiveBook && onReturnToEditor && (
            <button
              type="button"
              onClick={onReturnToEditor}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#D8D5CD] bg-white px-3 text-xs font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Back to {activeBookTitle ? 'Active PDF' : 'Editor'}
            </button>
          )}
        </div>

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
          className={`mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
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
                Supports textbooks, manuals, theses, and multi-chapter reports (.pdf)
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
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#0E4D6B] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0A3B52] whitespace-nowrap cursor-pointer"
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

        <div className="mt-5 flex items-center gap-2 text-xs text-[#6B7480]">
          <ShieldCheck className="h-4 w-4 text-[#15803D] shrink-0" aria-hidden="true" />
          <span>
            100% browser-local processing — your PDFs never leave your device, and no API keys or accounts are required.
          </span>
        </div>
      </div>

      {/* Workflow Overview Strip */}
      <div className="grid grid-cols-1 divide-y divide-[#ECEAE4] rounded-lg border border-[#E4E2DC] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14191F]">
            <Layers className="h-4 w-4 text-[#0E4D6B]" aria-hidden="true" />
            <span>1. Auto-Detect Chapters</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#525C68]">
            Reads embedded PDF bookmarks first, scans chapter and appendix headings second, or divides evenly by page count.
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14191F]">
            <Scissors className="h-4 w-4 text-[#0E4D6B]" aria-hidden="true" />
            <span>2. Preview &amp; Refine</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#525C68]">
            Inspect rendered pages, adjust start and end bounds, rename files, split at any page, or merge adjacent sections.
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14191F]">
            <FolderArchive className="h-4 w-4 text-[#0E4D6B]" aria-hidden="true" />
            <span>3. Export ZIP Bundle</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#525C68]">
            Download individual chapter PDFs or a numbered ZIP archive organized by Part folders with a MANIFEST.txt index.
          </p>
        </div>
      </div>
    </div>
  );
}
