export type ChapterKind = 'front-matter' | 'chapter' | 'appendix' | 'back-matter';

export type BundleMode = 'by-chapter' | 'by-part';

export type FolderLayout = 'nested-by-part' | 'flat';

export interface ChapterEntry {
  id: string;
  code: string; // e.g., "Ch. 01", "App. A", "Front"
  title: string;
  partId: string;
  partTitle: string;
  partDividerPage?: number; // Optional Part cover PDF page (1-indexed)
  kind: ChapterKind;
  startPage: number; // 1-indexed PDF page
  endPage: number; // 1-indexed PDF page (inclusive)
  bookPageLabel?: string; // e.g., "pp. 3–41"
  selected: boolean;
}

export interface BookDocument {
  id: string;
  title: string;
  subtitle?: string;
  authors?: string;
  publisher?: string;
  fileName: string;
  totalPages: number;
  fileSizeBytes: number;
  sourceType: 'uploaded';
  detectionMethod: 'pdf-outline' | 'heading-scan' | 'page-chunks';
}

export interface ZipBundleOptions {
  archiveName: string;
  bundleMode: BundleMode;
  folderLayout: FolderLayout;
  includePartDividers: boolean;
  includeManifest: boolean;
  prefixOrderNumbers: boolean;
}

export interface ArchiveFileSpec {
  id: string;
  zipPath: string;
  fileName: string;
  folderName: string | null;
  label: string;
  partTitle: string;
  sourceChapterIds: string[];
  /** 1-indexed inclusive page ranges to copy in order */
  pageRanges: Array<{ startPage: number; endPage: number }>;
  pageCount: number;
}

export interface ArchivePlan {
  archiveFileName: string;
  files: ArchiveFileSpec[];
  totalPdfFiles: number;
  totalPages: number;
  manifestContent: string;
}

export interface ValidationIssue {
  chapterId: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'splitting' | 'compressing' | 'complete' | 'error';
  currentIndex: number;
  totalFiles: number;
  currentLabel: string;
  percent: number;
}

export interface ExportResult {
  blobUrl: string;
  fileName: string;
  byteSize: number;
  fileCount: number;
  totalPages: number;
  createdAt: number;
}

export interface RawOutlineItem {
  title: string;
  pageNumber: number; // 1-indexed
  level: number; // 0 = top level, 1 = nested
}
