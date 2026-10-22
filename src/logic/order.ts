/**
 * Pure ordering logic for bookmarks and sections.
 *
 * Position is a dense 0..n-1 integer per section. Every mutation returns a new
 * array and recomputes positions, so the stored order is always unambiguous and
 * easy to test. No React, no I/O.
 */

export interface Positioned {
  id: string;
  position: number;
}

export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function nextPosition(items: readonly Positioned[]): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

/** Clamp an insertion index into a list of length `size`. */
export function clampIndex(index: number, size: number): number {
  if (!Number.isFinite(index)) return size;
  return Math.max(0, Math.min(Math.trunc(index), size));
}

/**
 * Move one item to `targetIndex` inside `targetSectionId`, re-packing positions
 * for every section touched. Items are matched by id, so stale order is fine.
 */
export function moveItem<T extends { id: string; sectionId: string; position: number }>(
  items: readonly T[],
  id: string,
  targetSectionId: string,
  targetIndex: number,
): T[] {
  const moving = items.find((item) => item.id === id);
  if (!moving) return [...items];

  const remaining = items.filter((item) => item.id !== id);
  const targetItems = sortByPosition(remaining.filter((item) => item.sectionId === targetSectionId));

  const index = clampIndex(targetIndex, targetItems.length);
  const moved = { ...moving, sectionId: targetSectionId };
  targetItems.splice(index, 0, moved as T);

  const repacked = new Map<string, number>();
  targetItems.forEach((item, position) => repacked.set(item.id, position));

  // Re-pack the section the item left, if it changed.
  if (moving.sectionId !== targetSectionId) {
    const source = sortByPosition(remaining.filter((item) => item.sectionId === moving.sectionId));
    source.forEach((item, position) => repacked.set(item.id, position));
  }

  return items.map((item) => {
    const position = repacked.get(item.id);
    return position === undefined ? item : { ...item, position, sectionId: item.id === id ? targetSectionId : item.sectionId };
  });
}

/** Append to the end of a section. */
export function appendPosition(items: readonly Positioned[]): number {
  return nextPosition(items);
}

/** Move a section to a new index, re-packing section positions. */
export function moveSection<T extends { id: string; position: number }>(
  sections: readonly T[],
  id: string,
  targetIndex: number,
): T[] {
  const moving = sections.find((section) => section.id === id);
  if (!moving) return [...sections];

  const rest = sortByPosition(sections.filter((section) => section.id !== id));
  const index = clampIndex(targetIndex, rest.length);
  rest.splice(index, 0, moving);

  return sections.map((section) => {
    const position = rest.findIndex((candidate) => candidate.id === section.id);
    return position === -1 ? section : { ...section, position };
  });
}
