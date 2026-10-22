import type { AppState, Bookmark, Section } from '../src/types.ts';
import { moveItem, nextPosition, sortByPosition } from '../src/logic/order.ts';
import { newId, type CreateBookmark, type Repo, type UpdateBookmark } from './repo.ts';

/**
 * Development and test storage. Used whenever DATABASE_URL is unset, so the app
 * runs without Docker. Data lives only as long as the process.
 */
export class MemoryRepo implements Repo {
  private sections: Section[] = [];
  private bookmarks: Bookmark[] = [];

  constructor(seed = true) {
    if (seed) {
      this.sections.push({ id: newId(), title: 'Favorites', position: 0 });
    }
  }

  async getState(): Promise<AppState> {
    return {
      sections: sortByPosition(this.sections),
      bookmarks: sortByPosition(this.bookmarks),
    };
  }

  async createSection(title: string): Promise<Section> {
    const section: Section = { id: newId(), title, position: nextPosition(this.sections) };
    this.sections.push(section);
    return section;
  }

  async renameSection(id: string, title: string): Promise<Section | null> {
    const section = this.sections.find((candidate) => candidate.id === id);
    if (!section) return null;
    section.title = title;
    return section;
  }

  async deleteSection(id: string): Promise<boolean> {
    const index = this.sections.findIndex((section) => section.id === id);
    if (index === -1) return false;
    this.sections.splice(index, 1);
    this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.sectionId !== id);
    return true;
  }

  async createBookmark(input: CreateBookmark): Promise<Bookmark> {
    const sectionBookmarks = this.bookmarks.filter((bookmark) => bookmark.sectionId === input.sectionId);
    const bookmark: Bookmark = {
      id: newId(),
      sectionId: input.sectionId,
      title: input.title,
      description: input.description,
      url: input.url,
      iconUrl: input.iconUrl,
      position: nextPosition(sectionBookmarks),
    };
    this.bookmarks.push(bookmark);
    return bookmark;
  }

  async updateBookmark(id: string, input: UpdateBookmark): Promise<Bookmark | null> {
    const bookmark = this.bookmarks.find((candidate) => candidate.id === id);
    if (!bookmark) return null;
    Object.assign(bookmark, input);
    return bookmark;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const index = this.bookmarks.findIndex((bookmark) => bookmark.id === id);
    if (index === -1) return false;
    this.bookmarks.splice(index, 1);
    return true;
  }

  async moveBookmark(id: string, sectionId: string, index: number): Promise<boolean> {
    const bookmark = this.bookmarks.find((candidate) => candidate.id === id);
    if (!bookmark) return false;
    if (!this.sections.some((section) => section.id === sectionId)) return false;

    this.bookmarks = moveItem(this.bookmarks, id, sectionId, index);
    return true;
  }

  async close(): Promise<void> {
    // Nothing to release.
  }
}
