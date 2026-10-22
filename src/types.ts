export interface Section {
  id: string;
  title: string;
  position: number;
}

export interface Bookmark {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  url: string;
  iconUrl: string | null;
  position: number;
}

export interface AppState {
  sections: Section[];
  bookmarks: Bookmark[];
}

export interface BookmarkInput {
  title: string;
  url: string;
  description?: string;
  iconUrl?: string | null;
}

export interface SectionInput {
  title: string;
}

export interface Link {
  title: string;
  url: string;
}
