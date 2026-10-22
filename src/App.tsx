import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { api } from './api';
import { BookmarkModal } from './components/BookmarkModal';
import { SectionModal } from './components/SectionModal';
import { SectionView } from './components/Section';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { columnsForWidth, groupBySection, resolveDrop, sectionUrls } from './logic/grid';
import type { AppState, Bookmark, BookmarkInput, Section } from './types';

type BookmarkModalState = { sectionId: string; bookmark: Bookmark | null } | null;
type SectionModalState = { section: Section | null } | null;

function initialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [columns, setColumns] = useState(() => columnsForWidth(window.innerWidth));
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [bookmarkModal, setBookmarkModal] = useState<BookmarkModalState>(null);
  const [sectionModal, setSectionModal] = useState<SectionModalState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onResize = () => setColumns(columnsForWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const grouped = useMemo(() => (state ? groupBySection(state.bookmarks) : new Map<string, Bookmark[]>()), [state]);

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Something went wrong');
  }

  async function handleSaveBookmark(sectionId: string, input: BookmarkInput) {
    try {
      if (bookmarkModal?.bookmark) await api.updateBookmark(bookmarkModal.bookmark.id, input);
      else await api.createBookmark({ ...input, sectionId } as BookmarkInput & { sectionId: string });
      setBookmarkModal(null);
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  async function handleDeleteBookmark(bookmark: Bookmark) {
    if (!window.confirm(`Delete "${bookmark.title}"?`)) return;
    try {
      await api.deleteBookmark(bookmark.id);
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  async function handleSaveSection(title: string) {
    try {
      if (sectionModal?.section) await api.renameSection(sectionModal.section.id, title);
      else await api.createSection(title);
      setSectionModal(null);
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  async function handleDeleteSection(section: Section) {
    if (!window.confirm(`Delete "${section.title}" and its bookmarks?`)) return;
    try {
      await api.deleteSection(section.id);
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  function handleOpenAll(sectionId: string) {
    const urls = sectionUrls(state?.bookmarks ?? [], sectionId);

    if (urls.length === 0) {
      setNotice('This section has no bookmarks to open.');
      return;
    }

    for (const url of urls) window.open(url, '_blank', 'noopener,noreferrer');

    setNotice(
      urls.length > 1
        ? `Asked the browser to open ${urls.length} sites. If only one opened, allow popups for this page.`
        : 'Opening 1 site.',
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !state || String(active.id) === String(over.id)) return;

    const destination = resolveDrop(String(over.id), state.bookmarks);
    if (!destination) return;

    try {
      await api.moveBookmark(String(active.id), destination.sectionId, destination.index);
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  const dragging = activeId && state ? state.bookmarks.find((bookmark) => bookmark.id === activeId) : null;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Favorite Sites</h1>
        <div className="app__actions">
          <button type="button" onClick={() => setSectionModal({ section: null })}>
            New section
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Toggle dark mode"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          {error}
          <button type="button" className="icon-button" onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {notice && (
        <div className="banner banner--info" role="status">
          {notice}
          <button type="button" className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {state === null && <p className="muted">Loading…</p>}

      {state !== null && state.sections.length === 0 && (
        <p className="muted">No sections yet. Create one to start adding bookmarks.</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <main>
          {state?.sections.map((section) => (
            <SectionView
              key={section.id}
              section={section}
              bookmarks={grouped.get(section.id) ?? []}
              columns={columns}
              onAddBookmark={(sectionId) => setBookmarkModal({ sectionId, bookmark: null })}
              onOpenAll={handleOpenAll}
              onRename={(target) => setSectionModal({ section: target })}
              onDelete={handleDeleteSection}
              onEditBookmark={(bookmark) => setBookmarkModal({ sectionId: bookmark.sectionId, bookmark })}
              onDeleteBookmark={handleDeleteBookmark}
            />
          ))}
        </main>

        <DragOverlay>{dragging ? <div className="tile tile--overlay">{dragging.title}</div> : null}</DragOverlay>
      </DndContext>

      {bookmarkModal && (
        <BookmarkModal
          sectionId={bookmarkModal.sectionId}
          bookmark={bookmarkModal.bookmark}
          onCancel={() => setBookmarkModal(null)}
          onSubmit={handleSaveBookmark}
        />
      )}

      {sectionModal && (
        <SectionModal
          section={sectionModal.section}
          onCancel={() => setSectionModal(null)}
          onSubmit={handleSaveSection}
        />
      )}
    </div>
  );
}
