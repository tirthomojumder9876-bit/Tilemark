import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRepo } from '../server/memory-repo';

let repo: MemoryRepo;

beforeEach(() => {
  repo = new MemoryRepo();
});

describe('MemoryRepo', () => {
  it('starts with one seeded section', async () => {
    const state = await repo.getState();
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0]?.title).toBe('Favorites');
    expect(state.bookmarks).toHaveLength(0);
  });

  it('appends bookmarks with increasing positions', async () => {
    const state = await repo.getState();
    const sectionId = state.sections[0]!.id;

    const first = await repo.createBookmark({
      sectionId,
      title: 'A',
      description: '',
      url: 'https://a.com',
      iconUrl: null,
    });
    const second = await repo.createBookmark({
      sectionId,
      title: 'B',
      description: '',
      url: 'https://b.com',
      iconUrl: null,
    });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
  });

  it('moves a bookmark between sections', async () => {
    const state = await repo.getState();
    const source = state.sections[0]!.id;
    const target = await repo.createSection('Reading');

    const bookmark = await repo.createBookmark({
      sectionId: source,
      title: 'A',
      description: '',
      url: 'https://a.com',
      iconUrl: null,
    });

    expect(await repo.moveBookmark(bookmark.id, target.id, 0)).toBe(true);

    const after = await repo.getState();
    expect(after.bookmarks[0]?.sectionId).toBe(target.id);
    expect(after.bookmarks[0]?.position).toBe(0);
  });

  it('rejects a move into an unknown section', async () => {
    const state = await repo.getState();
    const bookmark = await repo.createBookmark({
      sectionId: state.sections[0]!.id,
      title: 'A',
      description: '',
      url: 'https://a.com',
      iconUrl: null,
    });

    expect(await repo.moveBookmark(bookmark.id, 'nope', 0)).toBe(false);
  });

  it('deletes a section and its bookmarks', async () => {
    const state = await repo.getState();
    const sectionId = state.sections[0]!.id;

    await repo.createBookmark({
      sectionId,
      title: 'A',
      description: '',
      url: 'https://a.com',
      iconUrl: null,
    });

    expect(await repo.deleteSection(sectionId)).toBe(true);

    const after = await repo.getState();
    expect(after.sections).toHaveLength(0);
    expect(after.bookmarks).toHaveLength(0);
  });

  it('renames a section', async () => {
    const state = await repo.getState();
    const sectionId = state.sections[0]!.id;

    const renamed = await repo.renameSection(sectionId, 'Work');
    expect(renamed?.title).toBe('Work');

    const after = await repo.getState();
    expect(after.sections[0]?.title).toBe('Work');
  });

  it('updates a bookmark in place', async () => {
    const state = await repo.getState();
    const bookmark = await repo.createBookmark({
      sectionId: state.sections[0]!.id,
      title: 'A',
      description: '',
      url: 'https://a.com',
      iconUrl: null,
    });

    const updated = await repo.updateBookmark(bookmark.id, {
      title: 'B',
      description: 'desc',
      url: 'https://b.com',
      iconUrl: 'https://cdn/b.png',
    });

    expect(updated?.title).toBe('B');
    expect(updated?.iconUrl).toBe('https://cdn/b.png');

    const after = await repo.getState();
    expect(after.bookmarks[0]?.title).toBe('B');
  });

  it('returns null when updating a missing bookmark', async () => {
    expect(
      await repo.updateBookmark('nope', { title: 'X', description: '', url: 'https://x.com', iconUrl: null }),
    ).toBeNull();
  });
});
