import type { AppState, Bookmark } from '../src/types.ts';

export interface CreateBookmark {
  sectionId: string;
  title: string;
  description: string;
  url: string;
  iconUrl: string | null;
}

export interface UpdateBookmark {
  title: string;
  description: string;
  url: string;
  iconUrl: string | null;
}

/**
 * Storage boundary. The API layer only ever talks to this interface, so the
 * Postgres and in-memory implementations stay interchangeable and testable.
 */
export interface Repo {
  getState(): Promise<AppState>;
  createSection(title: string): Promise<{ id: string; title: string; position: number }>;
  renameSection(id: string, title: string): Promise<{ id: string; title: string; position: number } | null>;
  deleteSection(id: string): Promise<boolean>;
  createBookmark(input: CreateBookmark): Promise<Bookmark>;
  updateBookmark(id: string, input: UpdateBookmark): Promise<Bookmark | null>;
  deleteBookmark(id: string): Promise<boolean>;
  moveBookmark(id: string, sectionId: string, index: number): Promise<boolean>;
  close(): Promise<void>;
}

export function newId(): string {
  return crypto.randomUUID();
}
