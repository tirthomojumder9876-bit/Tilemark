import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { MemoryRepo } from '../server/memory-repo.ts';

let server: Server;
let base: string;
let repo: MemoryRepo;
let sectionId: string;

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function json(method: string, payload: unknown): RequestInit {
  return { method, body: JSON.stringify(payload) };
}

beforeAll(async () => {
  repo = new MemoryRepo();
  const app = createApp(repo);
  server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;

  const state = await api('/api/state');
  sectionId = state.body.sections[0].id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const { status, body } = await api('/api/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

describe('GET /api/state', () => {
  it('returns the seeded section', async () => {
    const { status, body } = await api('/api/state');
    expect(status).toBe(200);
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].title).toBe('Favorites');
  });
});

describe('POST /api/sections', () => {
  it('creates a section', async () => {
    const { status, body } = await api('/api/sections', json('POST', { title: 'Reading' }));
    expect(status).toBe(201);
    expect(body.title).toBe('Reading');
    expect(body.position).toBe(1);
  });

  it('rejects a blank title', async () => {
    const { status, body } = await api('/api/sections', json('POST', { title: '   ' }));
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});

describe('POST /api/bookmarks', () => {
  it('creates a bookmark and normalizes the url', async () => {
    const { status, body } = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'GitHub', url: 'github.com' }),
    );
    expect(status).toBe(201);
    expect(body.url).toBe('https://github.com/');
    expect(body.position).toBe(0);
    expect(body.sectionId).toBe(sectionId);
  });

  it('rejects an invalid url with a field error', async () => {
    const { status, body } = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'X', url: '!!!' }),
    );
    expect(status).toBe(400);
    expect(body.errors.url).toBeTruthy();
  });

  it('rejects an unknown section', async () => {
    const { status, body } = await api(
      '/api/bookmarks',
      json('POST', { sectionId: 'nope', title: 'X', url: 'example.com' }),
    );
    expect(status).toBe(400);
    expect(body.error).toBe('Unknown section');
  });
});

describe('PATCH and DELETE /api/bookmarks/:id', () => {
  it('updates title and description', async () => {
    const created = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'Temp', url: 'example.com' }),
    );
    const { status, body } = await api(
      `/api/bookmarks/${created.body.id}`,
      json('PATCH', { title: 'Renamed', url: 'example.com', description: 'desc' }),
    );
    expect(status).toBe(200);
    expect(body.title).toBe('Renamed');
    expect(body.description).toBe('desc');
  });

  it('returns 404 for a missing bookmark', async () => {
    const { status } = await api('/api/bookmarks/nope', json('PATCH', { title: 'A', url: 'a.com' }));
    expect(status).toBe(404);
  });

  it('deletes a bookmark, then 404s', async () => {
    const created = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'Gone', url: 'example.com' }),
    );
    const first = await api(`/api/bookmarks/${created.body.id}`, { method: 'DELETE' });
    expect(first.status).toBe(200);

    const second = await api(`/api/bookmarks/${created.body.id}`, { method: 'DELETE' });
    expect(second.status).toBe(404);
  });
});

describe('POST /api/bookmarks/:id/move', () => {
  it('moves a bookmark to another section and persists the order', async () => {
    const target = await api('/api/sections', json('POST', { title: 'Later' }));
    const created = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'Movable', url: 'example.com' }),
    );

    const moved = await api(
      `/api/bookmarks/${created.body.id}/move`,
      json('POST', { sectionId: target.body.id, index: 0 }),
    );
    expect(moved.status).toBe(200);

    const state = await api('/api/state');
    const bookmark = state.body.bookmarks.find((item: { id: string }) => item.id === created.body.id);
    expect(bookmark.sectionId).toBe(target.body.id);
    expect(bookmark.position).toBe(0);
  });

  it('rejects a move into an unknown section', async () => {
    const created = await api(
      '/api/bookmarks',
      json('POST', { sectionId, title: 'Stuck', url: 'example.com' }),
    );
    const { status } = await api(
      `/api/bookmarks/${created.body.id}/move`,
      json('POST', { sectionId: 'nope', index: 0 }),
    );
    expect(status).toBe(400);
  });
});

describe('unknown API routes', () => {
  it('returns JSON 404 instead of the SPA shell', async () => {
    const response = await fetch(`${base}/api/does-not-exist`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});
