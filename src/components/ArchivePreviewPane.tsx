import { Download, FileText, Folder, FolderArchive, Loader2 } from 'lucide-react';
import type { ArchiveFileSpec, ArchivePlan, ZipBundleOptions } from '../types/pdf';

interface ArchivePreviewPaneProps {
  plan: ArchivePlan;
  options: ZipBundleOptions;
  downloadingFileId: string | null;
  onDownloadSingleSpec: (spec: ArchiveFileSpec) => void;
  onExportZip: () => void;
  isExporting: boolean;
  canExport: boolean;
}

export function ArchivePreviewPane({
  plan,
  options,
  downloadingFileId,
  onDownloadSingleSpec,
  onExportZip,
  isExporting,
  canExport,
}: ArchivePreviewPaneProps) {
  // Group files by folderName for a clear ZIP directory tree
  const folderGroups: Array<{ folder: string | null; files: ArchiveFileSpec[] }> = [];
  const folderMap = new Map<string, ArchiveFileSpec[]>();

  for (const file of plan.files) {
    const key = file.folderName ?? '__root__';
    let list = folderMap.get(key);
    if (!list) {
      list = [];
      folderMap.set(key, list);
      folderGroups.push({ folder: file.folderName, files: list });
    }
    list.push(file);
  }

  return (
    <div className="rounded-lg border border-[#E4E2DC] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#ECEAE4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4 text-[#0E4D6B]" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-[#14191F]">
              {plan.archiveFileName}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[#525C68]">
            <span className="font-mono tabular-nums">{plan.totalPdfFiles}</span> PDF{' '}
            {plan.totalPdfFiles === 1 ? 'bundle' : 'bundles'}
            {options.includeManifest ? ' + MANIFEST.txt' : ''} ·{' '}
            <span className="font-mono tabular-nums">{plan.totalPages}</span> pages total
          </p>
        </div>

        <button
          type="button"
          onClick={onExportZip}
          disabled={!canExport || isExporting}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0E4D6B] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0A3B52] disabled:cursor-not-allowed disabled:bg-[#C6CCD2] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export Complete ZIP</span>
        </button>
      </div>

      {plan.files.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#14191F]">No PDF files selected for export</p>
          <p className="mt-1 text-xs text-[#6B7480]">
            Select one or more chapters in the Chapters &amp; Parts tab to populate the ZIP archive.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#ECEAE4]">
          {folderGroups.map((group) => (
            <div key={group.folder ?? '__root__'} className="px-5 py-3">
              {group.folder && (
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#525C68]">
                  <Folder className="h-3.5 w-3.5 text-[#0E4D6B]" aria-hidden="true" />
                  <span className="font-mono">{group.folder}/</span>
                  <span className="text-[#8B939E] tabular-nums">
                    ({group.files.length} {group.files.length === 1 ? 'PDF' : 'PDFs'})
                  </span>
                </div>
              )}

              <ul className={`divide-y divide-[#F2F0EB] ${group.folder ? 'pl-5' : ''}`}>
                {group.files.map((file) => {
                  const rangeLabel = file.pageRanges
                    .map((r) =>
                      r.startPage === r.endPage
                        ? `p. ${r.startPage}`
                        : `pp. ${r.startPage}–${r.endPage}`
                    )
                    .join(', ');
                  const isBusy = downloadingFileId === file.id;

                  return (
                    <li
                      key={file.id}
                      className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText
                          className="mt-0.5 h-4 w-4 text-[#0E4D6B] shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-medium text-[#14191F] break-all">
                            {file.fileName}
                          </div>
                          <div className="mt-0.5 text-xs text-[#6B7480] truncate">
                            {file.label} · PDF {rangeLabel}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="font-mono text-xs text-[#525C68] tabular-nums">
                          {file.pageCount} pp.
                        </span>
                        <button
                          type="button"
                          onClick={() => onDownloadSingleSpec(file)}
                          disabled={isBusy}
                          aria-label={`Download ${file.fileName}`}
                          className="inline-flex h-7 items-center gap-1 rounded border border-[#D8D5CD] bg-white px-2 text-xs font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>PDF</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {options.includeManifest && (
            <div className="flex items-center justify-between px-5 py-3 bg-[#FAF9F6]">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-[#6B7480]" aria-hidden="true" />
                <div>
                  <div className="font-mono text-xs font-medium text-[#14191F]">MANIFEST.txt</div>
                  <div className="text-xs text-[#6B7480]">
                    Index of all bundled chapters, filenames, and source PDF page ranges
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs text-[#6B7480]">Plain text</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
