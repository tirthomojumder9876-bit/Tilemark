import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { OpenAllModal } from './components/OpenAllModal';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { columnsForWidth, groupBySection, resolveDrop } from './logic/grid';
import { sortByPosition } from './logic/order';
import type { AppState, Bookmark, BookmarkInput, Link, Section } from './types';

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
  const [blockedLinks, setBlockedLinks] = useState<Link[] | null>(null);

  const sensors = useSensors(
    // Mouse drags immediately. Touch needs a deliberate hold with little movement,
    // otherwise a casual swipe would be swallowed instead of scrolling the page.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
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
    const bookmarks = sortByPosition(
      (state?.bookmarks ?? []).filter((bookmark) => bookmark.sectionId === sectionId),
    );

    if (bookmarks.length === 0) {
      setNotice('This section has no bookmarks to open.');
      return;
    }

    // Open synchronously inside the click handler so the first tab is attributed
    // to a user gesture. A null return means the popup blocker suppressed it.
    let blocked = 0;
    for (const bookmark of bookmarks) {
      const opened = window.open(bookmark.url, '_blank', 'noopener,noreferrer');
      if (!opened) blocked += 1;
    }

    if (blocked > 0) {
      setBlockedLinks(bookmarks.map((bookmark) => ({ title: bookmark.title, url: bookmark.url })));
      setNotice(
        `Your browser blocked ${blocked} of ${bookmarks.length} tabs. Allow popups for this page, or open them from the list.`,
      );
      return;
    }

    setNotice(bookmarks.length > 1 ? `Opened ${bookmarks.length} sites.` : 'Opened 1 site.');
  }

  function describeDrop(activeId: string, overId: string | null): string {
    const title = state?.bookmarks.find((bookmark) => bookmark.id === activeId)?.title ?? 'bookmark';
    if (!state || !overId) return `Dropped ${title}.`;

    const destination = resolveDrop(overId, state.bookmarks);
    if (!destination) return `Dropped ${title}.`;

    // The moved bookmark is not in the destination yet, so add it back in.
    const destinationCount = state.bookmarks.filter(
      (bookmark) => bookmark.sectionId === destination.sectionId && bookmark.id !== activeId,
    ).length;
    const total = destinationCount + 1;
    const sectionTitle = state.sections.find((section) => section.id === destination.sectionId)?.title ?? 'section';
    const position = Math.min(destination.index + 1, total);

    return `Moved ${title} to position ${position} of ${total} in ${sectionTitle}.`;
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

      <DndContext
        sensors={sensors}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Press space to pick up a bookmark. Use the arrow keys to move it, then space to drop it.',
          },
          announcements: {
            onDragStart: ({ active }) =>
              `Picked up ${state?.bookmarks.find((bookmark) => bookmark.id === active.id)?.title ?? 'bookmark'}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `Moving ${state?.bookmarks.find((bookmark) => bookmark.id === active.id)?.title ?? 'bookmark'} over another target.`
                : 'Not over a drop target.',
            onDragEnd: ({ active, over }) => describeDrop(String(active.id), over ? String(over.id) : null),
            onDragCancel: ({ active }) =>
              `Cancelled moving ${state?.bookmarks.find((bookmark) => bookmark.id === active.id)?.title ?? 'bookmark'}.`,
          },
        }}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <main>
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

      {blockedLinks && <OpenAllModal links={blockedLinks} onClose={() => setBlockedLinks(null)} />}

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
