# Favorite Sites

A project to add favorite websites and launch them in a new tab.

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

## Working here

- Keep local secrets in `.env`. It is gitignored and never committed.
- Never rewrite history or force push. If a task seems to need it, ask first.
- Keep commits focused, with a short bulleted description of what changed and why.
