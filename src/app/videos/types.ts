export interface VideoCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  categoryId: string | null;
  vimeoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  vimeoUrl: string;
  embedHtml: string;
  width: number;
  height: number;
  status: string;
  tags: string[] | null;
  transcript?: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SyncLogEntry {
  id: string;
  type: string;
  status: string;
  synced: number;
  updated: number;
  errors: number;
  totalProcessed: number;
  durationMs: number;
  createdAt: string;
}

export interface SyncProgress {
  page: number;
  totalPages: number;
  synced: number;
  updated: number;
  total: number;
}
