import { describe, expect, it } from 'vitest';
import { moveItem, moveSection, nextPosition, sortByPosition } from '../src/logic/order';

interface Item {
  id: string;
  sectionId: string;
  position: number;
}

function make(id: string, sectionId: string, position: number): Item {
  return { id, sectionId, position };
}

const items: Item[] = [make('a', 's1', 0), make('b', 's1', 1), make('c', 's2', 0)];

describe('nextPosition', () => {
  it('starts at zero for an empty list', () => {
    expect(nextPosition([])).toBe(0);
  });

  it('returns one past the highest position', () => {
    expect(nextPosition([make('a', 's1', 0), make('b', 's1', 2)])).toBe(3);
  });
});

describe('sortByPosition', () => {
  it('does not mutate the input', () => {
    const input = [make('b', 's1', 1), make('a', 's1', 0)];
    const sorted = sortByPosition(input);
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b']);
    expect(input.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('moveItem', () => {
  it('moves an item between sections and re-packs both', () => {
    const result = moveItem(items, 'a', 's2', 1);
    const s1 = sortByPosition(result.filter((item) => item.sectionId === 's1'));
    const s2 = sortByPosition(result.filter((item) => item.sectionId === 's2'));

    expect(s1.map((item) => item.id)).toEqual(['b']);
    expect(s1.map((item) => item.position)).toEqual([0]);
    expect(s2.map((item) => item.id)).toEqual(['c', 'a']);
    expect(s2.map((item) => item.position)).toEqual([0, 1]);
  });

  it('reorders within a section', () => {
    const result = moveItem(items, 'a', 's1', 2);
    const s1 = sortByPosition(result.filter((item) => item.sectionId === 's1'));
    expect(s1.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('clamps an out-of-range index', () => {
    const result = moveItem(items, 'a', 's2', 99);
    const s2 = sortByPosition(result.filter((item) => item.sectionId === 's2'));
    expect(s2.map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('ignores an unknown id', () => {
    expect(moveItem(items, 'nope', 's2', 0)).toHaveLength(items.length);
  });

  it('is pure', () => {
    const snapshot = JSON.stringify(items);
    moveItem(items, 'a', 's2', 0);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});

describe('moveSection', () => {
  it('reorders sections and re-packs positions', () => {
    const sections = [
      { id: 's1', position: 0 },
      { id: 's2', position: 1 },
      { id: 's3', position: 2 },
    ];
    const result = sortByPosition(moveSection(sections, 's3', 0));
    expect(result.map((section) => section.id)).toEqual(['s3', 's1', 's2']);
    expect(result.map((section) => section.position)).toEqual([0, 1, 2]);
  });
});
