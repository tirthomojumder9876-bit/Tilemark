import { describe, expect, it } from 'vitest';
import { columnsForWidth, groupBySection, resolveDrop, sectionUrls } from '../src/logic/grid';

describe('columnsForWidth', () => {
  it('uses two columns on small screens', () => {
    expect(columnsForWidth(320)).toBe(2);
    expect(columnsForWidth(390)).toBe(2);
    expect(columnsForWidth(639)).toBe(2);
  });

  it('scales up with the viewport', () => {
    expect(columnsForWidth(640)).toBe(3);
    expect(columnsForWidth(900)).toBe(4);
    expect(columnsForWidth(1200)).toBe(5);
    expect(columnsForWidth(1600)).toBe(6);
  });

  it('falls back to two for nonsense widths', () => {
    expect(columnsForWidth(Number.NaN)).toBe(2);
  });
});

describe('sectionUrls', () => {
  const bookmarks = [
    { sectionId: 's1', url: 'https://b.com', position: 1 },
    { sectionId: 's1', url: 'https://a.com', position: 0 },
    { sectionId: 's2', url: 'https://c.com', position: 0 },
  ];

  it('returns urls in position order', () => {
    expect(sectionUrls(bookmarks, 's1')).toEqual(['https://a.com', 'https://b.com']);
  });

  it('returns nothing for an unknown or empty section', () => {
    expect(sectionUrls(bookmarks, 's2')).toEqual(['https://c.com']);
    expect(sectionUrls(bookmarks, 'nope')).toEqual([]);
  });
});

describe('groupBySection', () => {
  it('groups and sorts by position', () => {
    const grouped = groupBySection([
      { id: 'b', sectionId: 's1', position: 1 },
      { id: 'a', sectionId: 's1', position: 0 },
      { id: 'c', sectionId: 's2', position: 0 },
    ]);

    expect(grouped.get('s1')?.map((item) => item.id)).toEqual(['a', 'b']);
    expect(grouped.get('s2')?.map((item) => item.id)).toEqual(['c']);
  });
});

describe('resolveDrop', () => {
  const bookmarks = [
    { id: 'a', sectionId: 's1', position: 0 },
    { id: 'b', sectionId: 's1', position: 1 },
    { id: 'c', sectionId: 's2', position: 0 },
  ];

  it('appends when dropping on an empty section', () => {
    expect(resolveDrop('section:s2', bookmarks)).toEqual({ sectionId: 's2', index: 1 });
  });

  it('appends when dropping on an empty section with no bookmarks', () => {
    expect(resolveDrop('section:s3', bookmarks)).toEqual({ sectionId: 's3', index: 0 });
  });

  it('targets the hovered bookmark position', () => {
    expect(resolveDrop('b', bookmarks)).toEqual({ sectionId: 's1', index: 1 });
  });

  it('returns null for an unknown target', () => {
    expect(resolveDrop('missing', bookmarks)).toBeNull();
  });
});
