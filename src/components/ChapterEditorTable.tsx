import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  GitMerge,
  Loader2,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { BundleMode, ChapterEntry, ValidationIssue } from '../types/pdf';
import { getChapterPageCount } from '../utils/chapterPlanner';

interface ChapterEditorTableProps {
  chapters: ChapterEntry[];
  totalPages: number;
  bundleMode: BundleMode;
  activeChapterId: string | null;
  issues: ValidationIssue[];
  isPreloadedBook: boolean;
  downloadingChapterId: string | null;
  onBundleModeChange: (mode: BundleMode) => void;
  onSelectChapterForPreview: (chapterId: string) => void;
  onToggleChapterSelected: (chapterId: string) => void;
  onTogglePartSelected: (partId: string, selected: boolean) => void;
  onSelectPreset: (preset: 'all' | 'chapters-only' | 'none') => void;
  onUpdateChapter: (
    chapterId: string,
    patch: Partial<Pick<ChapterEntry, 'title' | 'startPage' | 'endPage' | 'code'>>
  ) => void;
  onAddChapter: () => void;
  onDeleteChapter: (chapterId: string) => void;
  onSplitChapter: (chapterId: string, splitPage: number) => void;
  onMergeWithNext: (chapterId: string) => void;
  onAutoSplitByPages: (pagesPerChunk: number) => void;
  onResetPreloadedMap: () => void;
  onDownloadSingleChapter: (chapter: ChapterEntry) => void;
}

export function ChapterEditorTable({
  chapters,
  totalPages,
  bundleMode,
  activeChapterId,
  issues,
  isPreloadedBook,
  downloadingChapterId,
  onBundleModeChange,
  onSelectChapterForPreview,
  onToggleChapterSelected,
  onTogglePartSelected,
  onSelectPreset,
  onUpdateChapter,
  onAddChapter,
  onDeleteChapter,
  onSplitChapter,
  onMergeWithNext,
  onAutoSplitByPages,
  onResetPreloadedMap,
  onDownloadSingleChapter,
}: ChapterEditorTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutoSplitBar, setShowAutoSplitBar] = useState(false);
  const [chunkPagesInput, setChunkPagesInput] = useState('40');

  const issuesByChapter = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of issues) {
      const existing = map.get(issue.chapterId) ?? [];
      existing.push(issue);
      map.set(issue.chapterId, existing);
    }
    return map;
  }, [issues]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.partTitle.toLowerCase().includes(q) ||
        `${c.startPage}-${c.endPage}`.includes(q) ||
        String(c.startPage) === q
    );
  }, [chapters, searchQuery]);

  // Group filtered chapters by Part while preserving order
  const groupedParts = useMemo(() => {
    const groups: Array<{
      partId: string;
      partTitle: string;
      chapters: ChapterEntry[];
    }> = [];
    const map = new Map<string, ChapterEntry[]>();

    for (const ch of filteredChapters) {
      let list = map.get(ch.partId);
      if (!list) {
        list = [];
        map.set(ch.partId, list);
        groups.push({ partId: ch.partId, partTitle: ch.partTitle, chapters: list });
      }
      list.push(ch);
    }
    return groups;
  }, [filteredChapters]);

  const handleApplyAutoSplit = () => {
    const parsed = Number.parseInt(chunkPagesInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    onAutoSplitByPages(Math.min(totalPages, parsed));
    setShowAutoSplitBar(false);
  };

  return (
    <div className="rounded-lg border border-[#E4E2DC] bg-white">
      {/* Toolbar Header */}
      <div className="space-y-3 border-b border-[#ECEAE4] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77818D]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter chapters, parts, or page number…"
              aria-label="Filter chapters, parts, or page number"
              className="h-9 w-full rounded-md border border-[#D8D5CD] bg-[#FAF9F6] pl-9 pr-8 text-sm text-[#14191F] placeholder:text-[#848D98] focus:border-[#0E4D6B] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear chapter filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#6B7480] hover:text-[#14191F] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Bundling Mode Segmented Switcher */}
          <div
            role="group"
            aria-label="ZIP bundling mode"
            className="inline-flex h-9 items-center rounded-md border border-[#D8D5CD] bg-[#F7F6F3] p-0.5 shrink-0 self-start sm:self-auto"
          >
            <button
              type="button"
              onClick={() => onBundleModeChange('by-chapter')}
              aria-pressed={bundleMode === 'by-chapter'}
              className={`h-8 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                bundleMode === 'by-chapter'
                  ? 'bg-white text-[#14191F] shadow-xs'
                  : 'text-[#525C68] hover:text-[#14191F]'
              }`}
            >
              By Chapter
            </button>
            <button
              type="button"
              onClick={() => onBundleModeChange('by-part')}
              aria-pressed={bundleMode === 'by-part'}
              className={`h-8 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                bundleMode === 'by-part'
                  ? 'bg-white text-[#14191F] shadow-xs'
                  : 'text-[#525C68] hover:text-[#14191F]'
              }`}
            >
              Merged by Part
            </button>
          </div>
        </div>

        {/* Secondary Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#6B7480] mr-1">Select:</span>
            <button
              type="button"
              onClick={() => onSelectPreset('all')}
              className="rounded border border-[#E4E2DC] bg-[#FAF9F6] px-2.5 py-1 font-medium text-[#14191F] transition-colors hover:bg-[#EFECE6] cursor-pointer"
            >
              All ({chapters.length})
            </button>
            <button
              type="button"
              onClick={() => onSelectPreset('chapters-only')}
              className="rounded border border-[#E4E2DC] bg-[#FAF9F6] px-2.5 py-1 font-medium text-[#14191F] transition-colors hover:bg-[#EFECE6] cursor-pointer"
            >
              Chapters Only
            </button>
            <button
              type="button"
              onClick={() => onSelectPreset('none')}
              className="rounded border border-[#E4E2DC] bg-[#FAF9F6] px-2.5 py-1 font-medium text-[#525C68] transition-colors hover:bg-[#EFECE6] hover:text-[#14191F] cursor-pointer"
            >
              None
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setShowAutoSplitBar((prev) => !prev)}
              aria-expanded={showAutoSplitBar}
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                showAutoSplitBar
                  ? 'border-[#0E4D6B] bg-[#EEF5F8] text-[#0E4D6B]'
                  : 'border-[#E4E2DC] bg-white text-[#14191F] hover:bg-[#F7F6F3]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Auto-Split Pages</span>
            </button>

            <button
              type="button"
              onClick={onAddChapter}
              className="inline-flex items-center gap-1 rounded border border-[#E4E2DC] bg-white px-2.5 py-1 font-medium text-[#14191F] transition-colors hover:bg-[#F7F6F3] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Section</span>
            </button>

            {isPreloadedBook && (
              <button
                type="button"
                onClick={onResetPreloadedMap}
                className="inline-flex items-center gap-1 rounded border border-[#E4E2DC] bg-white px-2.5 py-1 font-medium text-[#525C68] transition-colors hover:bg-[#F7F6F3] hover:text-[#14191F] cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset Book Map</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Auto-Split Fixed Chunk Drawer */}
        {showAutoSplitBar && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#D4E2EA] bg-[#F3F8FA] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#14191F]">
              <label htmlFor="auto-split-pages-input" className="font-medium">
                Split entire {totalPages}-page PDF into equal sections of
              </label>
              <input
                id="auto-split-pages-input"
                type="number"
                min={1}
                max={totalPages}
                value={chunkPagesInput}
                onChange={(e) => setChunkPagesInput(e.target.value)}
                className="h-7 w-20 rounded border border-[#C2CFD6] bg-white px-2 font-mono text-xs tabular-nums focus:border-[#0E4D6B] focus:outline-none"
              />
              <span className="text-[#525C68]">pages each</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyAutoSplit}
                className="h-7 rounded bg-[#0E4D6B] px-3 text-xs font-medium text-white hover:bg-[#0A3B52] cursor-pointer"
              >
                Apply Split
              </button>
              <button
                type="button"
                onClick={() => setShowAutoSplitBar(false)}
                className="h-7 rounded border border-[#D8D5CD] bg-white px-2.5 text-xs font-medium text-[#525C68] hover:text-[#14191F] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Validation Summary Banner */}
        {(errorCount > 0 || warningCount > 0) && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              errorCount > 0
                ? 'border-[#F5C2C0] bg-[#FEF2F2] text-[#991B1B]'
                : 'border-[#F2DDA8] bg-[#FFFBEB] text-[#92400E]'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {errorCount > 0
                ? `${errorCount} page-range ${errorCount === 1 ? 'error' : 'errors'} must be fixed before exporting ZIP.`
                : `${warningCount} overlapping page ${warningCount === 1 ? 'range' : 'ranges'} detected across selected sections.`}
            </span>
          </div>
        )}
      </div>

      {/* Table Body */}
      {chapters.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#14191F]">No chapters or sections configured</p>
          <p className="mt-1 text-xs text-[#6B7480]">
            Add a custom page range or auto-split the document into equal-sized PDF bundles.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAddChapter}
              className="h-8 rounded-md bg-[#0E4D6B] px-3 text-xs font-medium text-white hover:bg-[#0A3B52] cursor-pointer"
            >
              Add First Section
            </button>
            <button
              type="button"
              onClick={() => onAutoSplitByPages(Math.max(10, Math.ceil(totalPages / 10)))}
              className="h-8 rounded-md border border-[#D8D5CD] bg-white px-3 text-xs font-medium text-[#14191F] hover:bg-[#F7F6F3] cursor-pointer"
            >
              Auto-Split PDF
            </button>
          </div>
        </div>
      ) : filteredChapters.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#14191F]">
            No sections match &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-1 text-xs text-[#6B7480]">
            Try searching by chapter title, Part number, or PDF page number.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 h-8 rounded-md border border-[#D8D5CD] bg-white px-3 text-xs font-medium text-[#14191F] hover:bg-[#F7F6F3] cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#ECEAE4]">
          {groupedParts.map((group) => {
            const allInPartSelected = group.chapters.every((c) => c.selected);
            const selectedInPartCount = group.chapters.filter((c) => c.selected).length;
            const partTotalPages = group.chapters.reduce(
              (sum, c) => sum + (c.selected ? getChapterPageCount(c) : 0),
              0
            );

            return (
              <section key={group.partId} aria-label={group.partTitle}>
                {/* Part Header Row */}
                <div className="flex items-center justify-between gap-3 bg-[#FAF9F6] px-4 py-2 border-b border-[#ECEAE4]">
                  <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={allInPartSelected}
                      onChange={(e) => onTogglePartSelected(group.partId, e.target.checked)}
                      aria-label={`Select all sections in ${group.partTitle}`}
                      className="h-4 w-4 rounded border-[#C2C7CE] text-[#0E4D6B] accent-[#0E4D6B] cursor-pointer"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#374151] truncate">
                      {group.partTitle}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-xs text-[#6B7480] shrink-0 tabular-nums">
                    <span>
                      {selectedInPartCount}/{group.chapters.length}{' '}
                      {group.chapters.length === 1 ? 'section' : 'sections'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{partTotalPages} pp.</span>
                  </div>
                </div>

                {/* Chapter Rows */}
                <ul className="divide-y divide-[#F0EEE8]">
                  {group.chapters.map((chapter) => {
                    const globalIdx = chapters.findIndex((c) => c.id === chapter.id);
                    const isLastGlobal = globalIdx === chapters.length - 1;
                    const pageCount = getChapterPageCount(chapter);
                    const isActive = activeChapterId === chapter.id;
                    const rowIssues = issuesByChapter.get(chapter.id) ?? [];
                    const hasError = rowIssues.some((i) => i.severity === 'error');
                    const isDownloading = downloadingChapterId === chapter.id;
                    const canSplit = pageCount >= 2;
                    const midSplitPage = chapter.startPage + Math.floor(pageCount / 2);

                    return (
                      <li
                        key={chapter.id}
                        className={`px-4 py-2.5 transition-colors ${
                          isActive ? 'bg-[#F2F7FA]' : 'hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                          {/* Left: Checkbox + Code + Editable Title */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={chapter.selected}
                              onChange={() => onToggleChapterSelected(chapter.id)}
                              aria-label={`Select ${chapter.code} ${chapter.title}`}
                              className="h-4 w-4 rounded border-[#C2C7CE] accent-[#0E4D6B] shrink-0 cursor-pointer"
                            />

                            <button
                              type="button"
                              onClick={() => onSelectChapterForPreview(chapter.id)}
                              aria-label={`Preview ${chapter.code} ${chapter.title}`}
                              className={`font-mono text-xs font-medium w-14 text-left shrink-0 cursor-pointer ${
                                isActive
                                  ? 'text-[#0E4D6B] underline underline-offset-2'
                                  : 'text-[#525C68] hover:text-[#0E4D6B]'
                              }`}
                            >
                              {chapter.code}
                            </button>

                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={chapter.title}
                                onFocus={() => onSelectChapterForPreview(chapter.id)}
                                onChange={(e) =>
                                  onUpdateChapter(chapter.id, { title: e.target.value })
                                }
                                aria-label={`Title for ${chapter.code}`}
                                className={`w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-[#14191F] hover:border-[#DFDDD6] focus:border-[#0E4D6B] focus:bg-white focus:outline-none ${
                                  !chapter.selected ? 'text-[#8B939E]' : ''
                                }`}
                              />
                              {chapter.bookPageLabel && (
                                <div className="px-1.5 text-[11px] text-[#77818D] tabular-nums">
                                  Book pp. {chapter.bookPageLabel}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: PDF Page Range Inputs + Count + Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pl-6 md:justify-end md:pl-0 shrink-0">
                            {/* Start / End Page Range */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[#77818D]">PDF</span>
                              <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={chapter.startPage}
                                onFocus={() => onSelectChapterForPreview(chapter.id)}
                                onChange={(e) => {
                                  const val = Number.parseInt(e.target.value, 10);
                                  onUpdateChapter(chapter.id, {
                                    startPage: Number.isNaN(val) ? 0 : val,
                                  });
                                }}
                                aria-label={`Start PDF page for ${chapter.code} ${chapter.title}`}
                                className={`h-7 w-16 rounded border bg-white px-1.5 text-right font-mono text-xs tabular-nums focus:border-[#0E4D6B] focus:outline-none ${
                                  hasError ? 'border-[#DC2626] text-[#991B1B]' : 'border-[#D8D5CD] text-[#14191F]'
                                }`}
                              />
                              <span className="text-xs text-[#8B939E]" aria-hidden="true">
                                –
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={chapter.endPage}
                                onFocus={() => onSelectChapterForPreview(chapter.id)}
                                onChange={(e) => {
                                  const val = Number.parseInt(e.target.value, 10);
                                  onUpdateChapter(chapter.id, {
                                    endPage: Number.isNaN(val) ? 0 : val,
                                  });
                                }}
                                aria-label={`End PDF page for ${chapter.code} ${chapter.title}`}
                                className={`h-7 w-16 rounded border bg-white px-1.5 text-right font-mono text-xs tabular-nums focus:border-[#0E4D6B] focus:outline-none ${
                                  hasError ? 'border-[#DC2626] text-[#991B1B]' : 'border-[#D8D5CD] text-[#14191F]'
                                }`}
                              />
                            </div>

                            {/* Page Count */}
                            <div className="w-14 text-right font-mono text-xs text-[#525C68] tabular-nums">
                              {pageCount} pp.
                            </div>

                            {/* Row Controls */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => onSelectChapterForPreview(chapter.id)}
                                aria-label={`Inspect pages of ${chapter.code} ${chapter.title}`}
                                title="Preview chapter pages"
                                className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-[#0E4D6B] text-white'
                                    : 'text-[#525C68] hover:bg-[#EAE7DF] hover:text-[#14191F]'
                                }`}
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDownloadSingleChapter(chapter)}
                                disabled={hasError || pageCount === 0 || isDownloading}
                                aria-label={`Download PDF for ${chapter.code} ${chapter.title}`}
                                title="Download this chapter as a single PDF"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#525C68] transition-colors hover:bg-[#EAE7DF] hover:text-[#0E4D6B] disabled:opacity-40 cursor-pointer"
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => onSplitChapter(chapter.id, midSplitPage)}
                                disabled={!canSplit}
                                aria-label={`Split ${chapter.code} ${chapter.title} into two sections`}
                                title={
                                  canSplit
                                    ? `Split at PDF page ${midSplitPage}`
                                    : 'Requires at least 2 pages to split'
                                }
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#525C68] transition-colors hover:bg-[#EAE7DF] hover:text-[#14191F] disabled:opacity-30 cursor-pointer"
                              >
                                <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onMergeWithNext(chapter.id)}
                                disabled={isLastGlobal}
                                aria-label={`Merge ${chapter.code} ${chapter.title} with next section`}
                                title="Merge with next section"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#525C68] transition-colors hover:bg-[#EAE7DF] hover:text-[#14191F] disabled:opacity-30 cursor-pointer"
                              >
                                <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteChapter(chapter.id)}
                                aria-label={`Remove ${chapter.code} ${chapter.title}`}
                                title="Remove section"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6B7480] transition-colors hover:bg-[#FEE2E2] hover:text-[#B91C1C] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline Row Issues */}
                        {rowIssues.length > 0 && (
                          <div className="mt-1.5 space-y-0.5 pl-6">
                            {rowIssues.map((issue, idx) => (
                              <p
                                key={`${chapter.id}-issue-${idx}`}
                                className={`text-xs ${
                                  issue.severity === 'error'
                                    ? 'text-[#B91C1C]'
                                    : 'text-[#B45309]'
                                }`}
                              >
                                {issue.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
