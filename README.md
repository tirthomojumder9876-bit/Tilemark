# Favorite Sites

A project to add favorite websites and launch them in a new tab.

The full requirements, data model, API contract, and verification matrix live in
[vault/spec.md](vault/spec.md).

## Setup

Clone the repository, then enable its hooks once:

```bash
git config core.hooksPath .githooks
```

This switches on the guards in `.githooks/`. They refuse history-rewriting commands
(`git reset`, `rebase`, `commit --amend`, `branch -D`) and force pushes. Skip this
step and the repo *looks* protected but isn't — the hook files are committed, the
setting that activates them is not.

That is the whole setup. Nothing else to install or build yet — the database below
needs Docker, and that is all.

## Development

```bash
npm install
npm run server   # API on :3001 (in-memory storage unless DATABASE_URL is set)
npm run dev      # Vite on :5173, proxies /api to the server
```

Run both in separate terminals. Other scripts:

| Script | Purpose |
| --- | --- |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve `dist/` and the API together on :3001 |
| `npm run test:e2e` | Playwright across Chromium, WebKit, and desktop |

The first e2e run needs browsers once: `npx playwright install chromium webkit`.
Set `E2E_BASE_URL=http://127.0.0.1:3001` to run the suite against the containerized
app instead of a local server.

Without `DATABASE_URL` the server keeps data in memory, so it resets on restart.
The compose setup below sets `DATABASE_URL` for you.

## Database

Postgres runs in Docker and is published on **127.0.0.1:5436** — loopback only, so
it is reachable from this machine but not from the network. The app container talks
to it internally as `db:5432`; host tools use the published port:

```bash
cp .env.example .env       # then set a real POSTGRES_PASSWORD
docker compose up --build  # app on :3001, Postgres on 127.0.0.1:5436
```

Connecting from the host:

```bash
psql "postgres://app:change-me@127.0.0.1:5436/app"
```

To run psql inside the container instead — no host client needed — use `bin/db`:

```bash
bin/db psql                # open psql inside the container
bin/db psql -c '\dt'       # passes arguments through
```

Other commands: `bin/db up`, `bin/db down`, `bin/db logs`, `bin/db exec <cmd>`.

The port is set by `DB_PORT` in `.env` (default 5436). Keep the binding on
`127.0.0.1`; changing it to `0.0.0.0` exposes the database to your network.

## Behaviour notes

- **Drag on touch:** long-press a tile for about 200ms, then drag. A quick swipe
  scrolls the page instead of picking the tile up.
- **Open all:** browsers often allow only one programmatic tab. When that happens the
  app says so and offers the same links as a normal list, so nothing fails silently.
- **Keyboard:** Tab to a tile, press Space to pick it up, arrow keys to move,
  Space to drop. Reorders are announced through a live region.
- **Firefox:** the Playwright Firefox build cannot start on macOS 27, so the project
  is skipped locally (`testIgnore`) and runs in CI on Linux.

## Working here

- Keep local secrets in `.env`. It is gitignored and never committed.
- Never rewrite history or force push. If a task seems to need it, ask first.
- Keep commits focused, with a short bulleted description of what changed and why.
