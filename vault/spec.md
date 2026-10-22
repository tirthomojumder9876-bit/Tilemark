# Favorite Sites — Specification

> Status: source of truth for the app. Every requirement carries two checkboxes:
> `[ ] Implemented` and `[ ] Verified`. Verification means the behavior was
> **observed** (test run, browser run), never inferred from reading code.

## 1. Purpose

A single-page web app that shows favorite websites as a grid of square tiles with
icons. Tiles open in a new tab. Bookmarks live in named sections, can be created,
edited, deleted, and dragged between sections. Sections can be opened all at once.

## 2. Scope

### In scope

- One user, running locally. No accounts, no sharing, no sync.
- Bookmark CRUD with title, description, URL, and icon.
- Sections with CRUD, containing bookmarks.
- Drag and drop of bookmarks between sections.
- Responsive, mobile-first layout with light and dark themes.
- Postgres persistence through Docker, with an in-memory fallback for dev/tests.

### Out of scope (non-goals)

- Authentication, multi-user data, permissions.
- Public deployment, HTTPS, CDN, analytics.
- Bookmark import from browsers, export, search, tags, or sharing.
- Offline/PWA support, service workers.
- Reordering sections, reordering within a section beyond drag placement.
- Image uploads. Icons are a URL or the site favicon only.

## 3. Users and environment

| Item | Value |
| --- | --- |
| User | One person, on their own machine |
| Browsers | Chrome and Safari verified via Playwright; Firefox blocked here (see 12.4) |
| Node | >= 22.6 (native TypeScript execution) |
| Database | Postgres 17 in Docker, published on `127.0.0.1:5436` |
| Fallback storage | In-memory when `DATABASE_URL` is unset |

## 4. Technology constraints

- **SPA:** React 18 + TypeScript (strict), built with Vite.
- **Server:** Node + Express, TypeScript executed directly by Node (no build step).
- **Database access:** `pg` only. No ORM.
- **Drag and drop:** `@dnd-kit` (core, sortable, utilities).
- **Unit tests:** Vitest. **E2E tests:** Playwright (Chromium, WebKit, desktop).
- **No CSS framework.** Plain CSS with custom properties.
- Every dependency must earn its place; do not add a library that duplicates an
  existing one.

---

## 5. Data model

### Section

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string (UUID) | Server-generated, immutable |
| `title` | string | Trimmed, 1–100 characters, required |
| `position` | integer | Dense, starts at 0, unique per dataset |

### Bookmark

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string (UUID) | Server-generated, immutable |
| `sectionId` | string | Must reference an existing section; cascade delete |
| `title` | string | Trimmed, 1–100 characters, required |
| `description` | string | Trimmed, 0–500 characters, defaults to `""` |
| `url` | string | Absolute `http:`/`https:` URL, normalized |
| `iconUrl` | string \| null | Optional absolute `http:`/`https:` URL |
| `position` | integer | Dense per section, starts at 0 |

### Rules

- Positions are re-packed to `0..n-1` after any insert, move, or delete.
- Deleting a section deletes its bookmarks (cascade).
- `url` accepts bare hosts (`example.com`) and adds `https://`.
- Non-http schemes (`javascript:`, `file:`, `ftp:`) are rejected.
- Hostnames must match `[a-z0-9.-]+` (or be a bracketed IPv6 literal).

---

## 6. API contract

Base path `/api`. JSON in, JSON out. The server is the only writer.

| Method | Path | Body | Success | Failure |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | — | `200 {"ok":true}` | — |
| GET | `/api/state` | — | `200 {sections,bookmarks}` | — |
| POST | `/api/sections` | `{title}` | `201 Section` | `400 {error}` |
| PATCH | `/api/sections/:id` | `{title}` | `200 Section` | `400 {error}`, `404` |
| DELETE | `/api/sections/:id` | — | `200 {"ok":true}` | `404` |
| POST | `/api/bookmarks` | `{sectionId,title,url,description?,iconUrl?}` | `201 Bookmark` | `400 {errors}`, `400 {error:"Unknown section"}` |
| PATCH | `/api/bookmarks/:id` | `{title,url,description?,iconUrl?}` | `200 Bookmark` | `400 {errors}`, `404` |
| DELETE | `/api/bookmarks/:id` | — | `200 {"ok":true}` | `404` |
| POST | `/api/bookmarks/:id/move` | `{sectionId,index}` | `200 {"ok":true}` | `400 {error}` |

**Error shapes.** Field validation returns `{"errors":{"title":"Title is required"}}`.
Everything else returns `{"error":"Message"}`. Unknown `/api/*` paths return
`404 {"error":"Not found"}` as JSON — never the SPA HTML.

**Example: create a bookmark**

```json
// POST /api/bookmarks
{ "sectionId": "…", "title": "GitHub", "url": "github.com" }

// 201
{ "id": "…", "sectionId": "…", "title": "GitHub", "description": "",
  "url": "https://github.com/", "iconUrl": null, "position": 0 }
```

---

## 7. Functional requirements

Each requirement lists acceptance criteria and two checkboxes. A cheaper agent can
implement from the criteria alone; the checkboxes say what is actually done.

### FR-1 — Tile grid

Tiles are square, show an icon and a title, and open in a new tab.

- [x] Implemented
- [x] Verified

**Acceptance:** every rendered tile has `height ≈ width` (within 1px); the tile is
an `<a>` with `target="_blank"` and `rel="noreferrer"`; a broken or missing icon
shows the first letter of the title.

### FR-2 — Add a bookmark

A dashed `+` tile sits last in every section and opens a modal.

- [x] Implemented
- [x] Verified

**Acceptance:** clicking `+` opens a dialog; saving valid input adds a tile to the
end of that section; the modal closes on save; positions stay dense.

### FR-3 — Edit a bookmark

- [x] Implemented
- [x] Verified

**Acceptance:** the edit modal opens prefilled; saving updates the tile; changing a
broken icon URL to a working one makes the icon appear without a reload; an invalid
`iconUrl` is rejected at save with a field error.

### FR-4 — Delete a bookmark

- [x] Implemented
- [x] Verified

**Acceptance:** a confirmation is required; confirming removes the tile and the
record; cancelling keeps it; remaining positions re-pack.

### FR-5 — Default icon

- [x] Implemented
- [x] Verified

**Acceptance:** with no `iconUrl`, the tile requests the site favicon; if that fails,
the initial letter renders in its place.

### FR-6 — Sections

- [x] Implemented
- [x] Verified

**Acceptance:** "New section" creates one; rename updates its title; delete prompts,
then removes the section **and its bookmarks**. Section position increments.

### FR-7 — Drag between sections

- [x] Implemented
- [x] Verified (mouse in Chromium/WebKit; touch in Chromium and WebKit)

**Acceptance:** dragging a tile onto another section moves it and persists through a
reload; dropping onto an empty section appends; a mouse drag works on desktop; a
touch hold-then-drag works on mobile without breaking page scroll.

### FR-8 — Open all

- [x] Implemented
- [x] Verified (request count and notice; actual tab opening is browser policy)

**Acceptance:** every section has an "Open all" button, including empty ones; it is
always enabled; clicking it opens each URL in a new tab; when the section is empty
or tabs may be blocked, an explanatory notice is shown.

> Verified that the app issues one `window.open` per bookmark and reports the count.
> Whether the browser honors them is outside the app's control; it must never fail
> silently.

### FR-9 — Dark mode

- [x] Implemented
- [x] Verified

**Acceptance:** a toggle switches theme and repaints background and text; the choice
persists across reloads; the initial theme follows `prefers-color-scheme` when no
choice is stored; `color-scheme` is set so native controls match.

### FR-10 — Responsive layout

- [x] Implemented
- [x] Verified

| Viewport width | Columns |
| --- | --- |
| < 640px | 2 |
| 640–899px | 3 |
| 900–1199px | 4 |
| 1200–1599px | 5 |
| ≥ 1600px | 6 |

**Acceptance:** the column count matches the table at each breakpoint; no horizontal
scrolling at 360px; tiles remain square at every width; at 200% text scaling there is
no horizontal overflow and every control stays at least 40x40.

### FR-11 — Persistence

- [x] Implemented
- [x] Verified

**Acceptance:** with `DATABASE_URL` set, data survives an app restart; without it,
the server uses in-memory storage and logs which mode is active; the database is
reachable only through `bin/db` or the published loopback port.

### FR-12 — Pure logic extracted

- [x] Implemented
- [x] Verified

**Acceptance:** URL handling, validation, ordering, layout math, and drop resolution
live in `src/logic/` with no React or I/O imports, and are covered by unit tests.

### FR-13 — Dumb visual components

- [x] Implemented
- [x] Verified

**Acceptance:** components in `src/components/` receive data and callbacks through
props, perform no fetching, and hold only local UI state. They may call the pure
validators; they must not own business rules.

### FR-14 — Accessibility

- [x] Implemented
- [x] Verified

**Acceptance:** every interactive control is at least 40×40px; dialogs close on
Escape and trap focus; every icon-only button has an `aria-label`; the modal is
labelled by its heading; Enter on a tile opens the link instead of starting a drag.

### FR-15 — Error handling

- [x] Implemented
- [x] Verified

**Acceptance:** API failures surface a dismissible banner; field errors appear next
to their inputs; the app never fails silently; unknown API routes return JSON 404.

### FR-16 — Configuration

- [x] Implemented
- [x] Verified

**Acceptance:** `PORT`, `DATABASE_URL`, `POSTGRES_*`, `DB_PORT` come from `.env`;
the server starts without `.env`; compose reads the same file.

---

## 8. UI specification

**Header:** app title, "New section", theme toggle (40×40 minimum).

**Section:** heading with title and a count badge, plus "Open all", "Rename", and
"Delete" buttons. An empty section shows "Nothing here yet — use the + tile to add a
bookmark."

**Grid:** CSS grid with `--cols` from FR-10, 12px gaps (16px ≥640px), tiles square.

**Tile:** icon box 40×40 (48×48 ≥640px), title clamped to 2 lines, description
clamped to 2 lines, edit and delete buttons 40×40 in the top-right corner, always
visible (never hover-only).

**Modal:** centred dialog, max width 420px, fields Title, URL, Description, Icon URL,
then Cancel and Save (44px tall). Backdrop click and Escape close it.

**Banners:** error (danger colours) and info (neutral) variants, both dismissible.

**Theming:** CSS custom properties on `:root` and `[data-theme="dark"]`, with a
`prefers-color-scheme` fallback before JavaScript runs.

---

## 9. Code organization

```
src/
  logic/        pure functions only, each unit tested
  components/   presentational React components
  App.tsx       state, data loading, drag wiring
server/
  app.ts        createApp(repo) — routes only
  index.ts      process entry: repo selection, listen
  repo.ts       Repo interface
  memory-repo.ts / pg-repo.ts
tests/          Vitest unit + HTTP tests
e2e/            Playwright specs
```

Rules for implementers:

1. Business rules belong in `src/logic/` and must have tests.
2. Server routes validate through the same `src/logic/validation.ts` used by the UI.
3. Storage is behind the `Repo` interface; both implementations must pass the same
   behavior tests.
4. Do not edit `.githooks/`. Do not bypass hooks with `--no-verify`.
5. Commit through the `commit` skill; never push.

---

## 10. Testing strategy

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | URL, validation, ordering, layout, drop resolution |
| Repo | Vitest | Memory repo behavior, positions, cascade delete |
| HTTP | Vitest | Every route, error shapes, JSON 404 |
| Accessibility | axe-core | Main page, both modals, error state, light and dark |
| E2E | Playwright | Chromium (Pixel 7), WebKit (iPhone 13), desktop 1440×900 |
| Responsive | Playwright | 280–1920px, landscape, every breakpoint boundary, 200% text |

**Verification matrix**

| Requirement | Evidence |
| --- | --- |
| FR-1, FR-2, FR-3, FR-4, FR-5 | `e2e/app.spec.ts` |
| FR-6 | `e2e/app.spec.ts` create, rename, delete |
| FR-7 | `e2e/app.spec.ts` drag tests (mouse + touch), `e2e/touch-webkit.spec.ts` |
| FR-8 | `e2e/app.spec.ts` notice + request-count tests |
| FR-9 | `e2e/app.spec.ts` dark mode |
| FR-10 | `e2e/app.spec.ts` + `e2e/responsive.spec.ts` (boundaries, landscape, 200% text) |
| FR-11 | `docker compose` restart test + `bin/db psql` |
| FR-12 | `tests/*.test.ts` |
| FR-13 | Code review against the rule |
| FR-14 | `e2e/app.spec.ts` tap targets + modal focus, `e2e/a11y.spec.ts` |
| FR-15 | `tests/api.test.ts` + `e2e/app.spec.ts` banner test |
| FR-16 | `docker compose up` with `.env` |

A requirement is only ticked Verified when a command was run and its output
observed. Reading the code is not verification.

---

## 11. Definition of done

- [x] `npm test` passes
- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] `npm run test:e2e` passes across all three projects
- [x] `docker compose up --build` serves the app with Postgres on 5436
- [x] Every FR above has both checkboxes ticked
- [x] No secrets committed; `.env` stays ignored
- [x] Nothing pushed

---

## 12. Known gaps

These are real, unfixed, and must not be presented as complete:

1. Native mobile gestures are unverified. WebKit touch drag is covered by synthetic
   `TouchEvent`s (`document.createTouch` / `createTouchList`), which exercises the
   dnd-kit path but not native iOS scroll arbitration, `touchcancel`, or callouts.
   A real device is still required for those.
2. Multi-tab "open all" depends on browser popup policy. The app is verified to
   request every URL, but the browser may still open only one.
3. At 200% text scaling, tile contents clip: long titles and descriptions truncate
   and the edit/delete controls overlay the icon. There is no overflow and controls
   stay 40px, so no assertion fails — but this needs a design decision (scale the
   content, relax the square aspect, or hide text at large sizes).
4. Firefox cannot run in this environment. Playwright's Firefox 157 build exits at
   startup with "Could not find profile folder" on macOS 27.0.1, even with an
   explicit profile directory, so no Firefox project is configured. Revisit when a
   compatible Playwright/Firefox build exists.
5. No real-device testing (iOS Safari, Android Chrome) and no screen-reader audit
   beyond the automated axe checks.

## 13. Commands

```bash
npm install
npm run server          # API on :3001, in-memory unless DATABASE_URL is set
npm run dev             # Vite on :5173, proxies /api
npm test                # Vitest
npm run test:e2e        # Playwright (needs npx playwright install chromium webkit once)
npm run typecheck
npm run build
docker compose up -d --build
bin/db psql             # psql inside the container
```

---

## Author Note (original)

Goal of the project: list out favorite sites with a nice icon, as a grid of squares.
CRUD: add favorites, edit title/description and the selected photo, with a default
photo so it is optional. A square at the end with a `+` to add a bookmark in a modal.
A SPA, mobile-first: two bookmarks per row on small devices, four to six on desktop.
Create sections and drag and drop between them. A button to open all from a section,
always. Extract pure logic into testable functions. Keep visual components as dumb as
possible. Dark mode. Postgres in a container.
