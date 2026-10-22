import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Bookmark, Section } from '../types';
import { AddTile } from './AddTile';
import { Tile } from './Tile';

interface SectionProps {
  section: Section;
  bookmarks: Bookmark[];
  columns: number;
  onAddBookmark: (sectionId: string) => void;
  onOpenAll: (sectionId: string) => void;
  onRename: (section: Section) => void;
  onDelete: (section: Section) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

export function SectionView({
  section,
  bookmarks,
  columns,
  onAddBookmark,
  onOpenAll,
  onRename,
  onDelete,
  onEditBookmark,
  onDeleteBookmark,
}: SectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section.id}` });

  return (
    <section className="section" aria-labelledby={`section-${section.id}`}>
      <header className="section__header">
        <h2 id={`section-${section.id}`} className="section__title">
          {section.title}
          <span className="section__count">{bookmarks.length}</span>
        </h2>
        <div className="section__actions">
          <button type="button" onClick={() => onOpenAll(section.id)} disabled={bookmarks.length === 0}>
            Open all
          </button>
          <button type="button" onClick={() => onRename(section)}>
            Rename
          </button>
          <button type="button" className="danger" onClick={() => onDelete(section)}>
            Delete
          </button>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className="grid"
        data-over={isOver || undefined}
        style={{ ['--cols' as string]: String(columns) }}
      >
        <SortableContext items={bookmarks.map((bookmark) => bookmark.id)} strategy={rectSortingStrategy}>
          {bookmarks.map((bookmark) => (
            <Tile
              key={bookmark.id}
              bookmark={bookmark}
              onEdit={onEditBookmark}
              onDelete={onDeleteBookmark}
            />
          ))}
        </SortableContext>
        <AddTile onClick={() => onAddBookmark(section.id)} />
      </div>
    </section>
  );
}
