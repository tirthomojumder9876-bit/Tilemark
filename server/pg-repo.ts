import pg from 'pg';
import type { AppState, Bookmark, Section } from '../src/types.ts';
import { moveItem } from '../src/logic/order.ts';
import { newId, type CreateBookmark, type Repo, type UpdateBookmark } from './repo.ts';

const SCHEMA = `
create table if not exists sections (
  id text primary key,
  title text not null,
  position integer not null
);

create table if not exists bookmarks (
  id text primary key,
  section_id text not null references sections(id) on delete cascade,
  title text not null,
  description text not null default '',
  url text not null,
  icon_url text,
  position integer not null
);

create index if not exists bookmarks_section_position
  on bookmarks (section_id, position);
`;

interface SectionRow {
  id: string;
  title: string;
  position: number;
}

interface BookmarkRow {
  id: string;
  section_id: string;
  title: string;
  description: string;
  url: string;
  icon_url: string | null;
  position: number;
}

function toSection(row: SectionRow): Section {
  return { id: row.id, title: row.title, position: row.position };
}

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    sectionId: row.section_id,
    title: row.title,
    description: row.description,
    url: row.url,
    iconUrl: row.icon_url,
    position: row.position,
  };
}

export class PgRepo implements Repo {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA);
    const { rows } = await this.pool.query<{ count: string }>('select count(*)::text as count from sections');
    if (rows[0]?.count === '0') {
      await this.pool.query('insert into sections (id, title, position) values ($1, $2, $3)', [
        newId(),
        'Favorites',
        0,
      ]);
    }
  }

  async getState(): Promise<AppState> {
    const [sections, bookmarks] = await Promise.all([
      this.pool.query<SectionRow>('select id, title, position from sections order by position, id'),
      this.pool.query<BookmarkRow>(
        'select id, section_id, title, description, url, icon_url, position from bookmarks order by position, id',
      ),
    ]);

    return {
      sections: sections.rows.map(toSection),
      bookmarks: bookmarks.rows.map(toBookmark),
    };
  }

  async createSection(title: string): Promise<Section> {
    const { rows } = await this.pool.query<{ position: number }>(
      'select coalesce(max(position) + 1, 0)::int as position from sections',
    );
    const position = rows[0]?.position ?? 0;
    const id = newId();
    await this.pool.query('insert into sections (id, title, position) values ($1, $2, $3)', [id, title, position]);
    return { id, title, position };
  }

  async renameSection(id: string, title: string): Promise<Section | null> {
    const { rows } = await this.pool.query<SectionRow>(
      'update sections set title = $2 where id = $1 returning id, title, position',
      [id, title],
    );
    return rows[0] ? toSection(rows[0]) : null;
  }

  async deleteSection(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('delete from sections where id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async createBookmark(input: CreateBookmark): Promise<Bookmark> {
    const { rows } = await this.pool.query<{ position: number }>(
      'select coalesce(max(position) + 1, 0)::int as position from bookmarks where section_id = $1',
      [input.sectionId],
    );
    const position = rows[0]?.position ?? 0;
    const id = newId();

    const inserted = await this.pool.query<BookmarkRow>(
      `insert into bookmarks (id, section_id, title, description, url, icon_url, position)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, section_id, title, description, url, icon_url, position`,
      [id, input.sectionId, input.title, input.description, input.url, input.iconUrl, position],
    );

    return toBookmark(inserted.rows[0] as BookmarkRow);
  }

  async updateBookmark(id: string, input: UpdateBookmark): Promise<Bookmark | null> {
    const { rows } = await this.pool.query<BookmarkRow>(
      `update bookmarks set title = $2, description = $3, url = $4, icon_url = $5
       where id = $1
       returning id, section_id, title, description, url, icon_url, position`,
      [id, input.title, input.description, input.url, input.iconUrl],
    );
    return rows[0] ? toBookmark(rows[0]) : null;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('delete from bookmarks where id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async moveBookmark(id: string, sectionId: string, index: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const { rows } = await client.query<BookmarkRow>(
        'select id, section_id, title, description, url, icon_url, position from bookmarks',
      );
      const all = rows.map(toBookmark);
      const moving = all.find((bookmark) => bookmark.id === id);
      if (!moving) {
        await client.query('rollback');
        return false;
      }

      const { rows: sectionRows } = await client.query('select 1 from sections where id = $1', [sectionId]);
      if (sectionRows.length === 0) {
        await client.query('rollback');
        return false;
      }

      const updated = moveItem(all, id, sectionId, index);

      for (const bookmark of updated) {
        const previous = all.find((candidate) => candidate.id === bookmark.id);
        if (!previous) continue;
        if (previous.position === bookmark.position && previous.sectionId === bookmark.sectionId) continue;
        await client.query('update bookmarks set position = $2, section_id = $3 where id = $1', [
          bookmark.id,
          bookmark.position,
          bookmark.sectionId,
        ]);
      }

      await client.query('commit');
      return true;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
