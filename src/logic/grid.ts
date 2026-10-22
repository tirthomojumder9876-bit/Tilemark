/**
 * Pure layout and section helpers.
 */

/** Grid columns for a viewport width. Small screens get exactly two per row. */
export function columnsForWidth(width: number): number {
  if (!Number.isFinite(width) || width < 640) return 2;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  if (width < 1600) return 5;
  return 6;
}

/** URLs for a section, in display order, for the "open all" action. */
export function sectionUrls(
  bookmarks: readonly { sectionId: string; url: string; position: number }[],
  sectionId: string,
): string[] {
  return bookmarks
    .filter((bookmark) => bookmark.sectionId === sectionId)
    .sort((a, b) => a.position - b.position)
    .map((bookmark) => bookmark.url);
}

/** Group bookmarks by section id, preserving position order. */
export function groupBySection<T extends { sectionId: string; position: number }>(
  bookmarks: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const bookmark of bookmarks) {
    const list = grouped.get(bookmark.sectionId) ?? [];
    list.push(bookmark);
    grouped.set(bookmark.sectionId, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  return grouped;
}

/**
 * Turn a drag target into a destination. `overId` is either a bookmark id or a
 * `section:<id>` droppable, which means "append to the end of that section".
 */
export function resolveDrop(
  overId: string,
  bookmarks: readonly { id: string; sectionId: string; position: number }[],
): { sectionId: string; index: number } | null {
  if (overId.startsWith('section:')) {
    const sectionId = overId.slice('section:'.length);
    const count = bookmarks.filter((bookmark) => bookmark.sectionId === sectionId).length;
    return { sectionId, index: count };
  }

  const target = bookmarks.find((bookmark) => bookmark.id === overId);
  if (!target) return null;

  const siblings = bookmarks
    .filter((bookmark) => bookmark.sectionId === target.sectionId)
    .sort((a, b) => a.position - b.position);

  return { sectionId: target.sectionId, index: siblings.findIndex((bookmark) => bookmark.id === overId) };
}
