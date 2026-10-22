/**
 * Pure input validation shared by the client and the server.
 */

import { normalizeUrl } from './url.ts';

export interface BookmarkDraft {
  title: string;
  url: string;
  description?: string;
  iconUrl?: string | null;
}

export type BookmarkErrors = Partial<Record<keyof BookmarkDraft, string>>;

export type ValidationResult =
  | { ok: true; value: Required<Pick<BookmarkDraft, 'title' | 'url'>> & { description: string; iconUrl: string | null } }
  | { ok: false; errors: BookmarkErrors };

export const MAX_TITLE = 100;
export const MAX_DESCRIPTION = 500;

export function validateBookmark(draft: BookmarkDraft): ValidationResult {
  const errors: BookmarkErrors = {};

  const title = draft.title.trim();
  if (title === '') errors.title = 'Title is required';
  else if (title.length > MAX_TITLE) errors.title = `Title must be ${MAX_TITLE} characters or fewer`;

  const url = normalizeUrl(draft.url);
  if (url === null) errors.url = 'Enter a valid web address';

  const description = (draft.description ?? '').trim();
  if (description.length > MAX_DESCRIPTION) {
    errors.description = `Description must be ${MAX_DESCRIPTION} characters or fewer`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const iconUrl = draft.iconUrl?.trim();

  return {
    ok: true,
    value: { title, url: url as string, description, iconUrl: iconUrl ? iconUrl : null },
  };
}

export function validateSectionTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed === '') return 'Section name is required';
  if (trimmed.length > MAX_TITLE) return `Section name must be ${MAX_TITLE} characters or fewer`;
  return null;
}
