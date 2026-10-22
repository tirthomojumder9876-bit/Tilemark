import type { AppState, Bookmark, BookmarkInput, Section } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string> };
    const message = body.error ?? (body.errors ? Object.values(body.errors).join(', ') : `Request failed (${response.status})`);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  state: () => request<AppState>('/api/state'),

  createSection: (title: string) =>
    request<Section>('/api/sections', { method: 'POST', body: JSON.stringify({ title }) }),

  renameSection: (id: string, title: string) =>
    request<Section>(`/api/sections/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),

  deleteSection: (id: string) =>
    request<{ ok: true }>(`/api/sections/${id}`, { method: 'DELETE' }),

  createBookmark: (input: BookmarkInput) =>
    request<Bookmark>('/api/bookmarks', { method: 'POST', body: JSON.stringify(input) }),

  updateBookmark: (id: string, input: BookmarkInput) =>
    request<Bookmark>(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteBookmark: (id: string) =>
    request<{ ok: true }>(`/api/bookmarks/${id}`, { method: 'DELETE' }),

  moveBookmark: (id: string, sectionId: string, index: number) =>
    request<{ ok: true }>(`/api/bookmarks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ sectionId, index }),
    }),
};
