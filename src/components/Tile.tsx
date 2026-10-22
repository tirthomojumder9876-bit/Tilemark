import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Bookmark } from '../types';
import { faviconUrl, initialFor } from '../logic/url';

interface TileProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

/** Presentational tile. All behavior arrives through props. */
export function Tile({ bookmark, onEdit, onDelete }: TileProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bookmark.id });

  const icon = bookmark.iconUrl ?? faviconUrl(bookmark.url);
  const showIcon = icon !== '' && icon !== failedSrc;

  return (
    <div
      ref={setNodeRef}
      className="tile"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // dnd-kit defaults to role="button"; the tile wraps a real link and
      // buttons, so expose it as a group instead of nesting controls.
      role="group"
    >
      <a
        className="tile__link"
        href={bookmark.url}
        target="_blank"
        rel="noreferrer"
        // Let Enter open the link instead of starting a keyboard drag.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation();
        }}
      >
        <span className="tile__icon" aria-hidden="true">
          <span className="tile__initial">{initialFor(bookmark.title, bookmark.url)}</span>
          {showIcon && <img src={icon} alt="" loading="lazy" onError={() => setFailedSrc(icon)} />}
        </span>
        <span className="tile__title">{bookmark.title}</span>
        {bookmark.description !== '' && <span className="tile__desc">{bookmark.description}</span>}
      </a>

      <div className="tile__actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`Edit ${bookmark.title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(bookmark);
          }}
        >
          ✎
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Delete ${bookmark.title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(bookmark);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
