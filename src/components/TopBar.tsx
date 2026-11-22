import { BookOpen, Download, FolderArchive, Loader2, Upload } from 'lucide-react';
import type { ExportProgress } from '../types/pdf';

export type WorkspaceTab = 'chapters' | 'archive' | 'upload';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  hasDocument: boolean;
  selectedPdfCount: number;
  canExport: boolean;
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  onExportZip: () => void;
}

export function TopBar({
  activeTab,
  onSelectTab,
  hasDocument,
  selectedPdfCount,
  canExport,
  isExporting,
  exportProgress,
  onExportZip,
}: TopBarProps) {
  const tabs: Array<{
    id: WorkspaceTab;
    label: string;
    icon: typeof BookOpen;
    disabled: boolean;
  }> = [
    { id: 'chapters', label: 'Chapters & Parts', icon: BookOpen, disabled: !hasDocument },
    { id: 'archive', label: 'ZIP Structure', icon: FolderArchive, disabled: !hasDocument },
    { id: 'upload', label: 'Upload PDF', icon: Upload, disabled: false },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E2DC] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0E4D6B] text-white">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-display text-[17px] font-semibold tracking-tight text-[#14191F] whitespace-nowrap">
            FolioSplit
          </span>
        </div>

        {/* Zone 2: Primary Navigation Tabs (Desktop) */}
        <nav
          aria-label="Workspace sections"
          className="hidden md:flex h-full items-center gap-1"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex h-full items-center gap-2 px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab.disabled
                    ? 'cursor-not-allowed text-[#B0B7C0]'
                    : isActive
                      ? 'cursor-pointer text-[#0E4D6B]'
                      : 'cursor-pointer text-[#525C68] hover:text-[#14191F]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {isActive && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[2px] bg-[#0E4D6B]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportZip}
            disabled={!canExport || isExporting}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0E4D6B] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0A3B52] disabled:cursor-not-allowed disabled:bg-[#C6CCD2] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  Bundling {exportProgress?.percent ?? 0}%
                </span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Download ZIP</span>
                {hasDocument && (
                  <span className="hidden sm:inline font-mono text-xs text-white/80 tabular-nums">
                    ({selectedPdfCount})
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Secondary Navigation Strip */}
      <nav
        aria-label="Mobile workspace sections"
        className="grid grid-cols-3 border-t border-[#ECEAE4] bg-white md:hidden"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={`mobile-${tab.id}`}
              type="button"
              disabled={tab.disabled}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-10 items-center justify-center gap-1.5 px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                tab.disabled
                  ? 'cursor-not-allowed text-[#B0B7C0]'
                  : isActive
                    ? 'cursor-pointer text-[#0E4D6B]'
                    : 'cursor-pointer text-[#525C68]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-3 bottom-0 h-[2px] bg-[#0E4D6B]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
