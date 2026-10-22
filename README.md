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
Set `DATABASE_URL=postgres://app:password@db:5432/app` when running inside compose
to use Postgres.

## Database

Postgres runs in Docker with **no published port**. There is no host `psql` to
install or use, because there is no host connection to make. Everything goes
through the container:

```bash
cp .env.example .env   # then set a real POSTGRES_PASSWORD
bin/db up              # start Postgres
bin/db psql            # open psql inside the container
```

`bin/db psql` passes arguments through, so `bin/db psql -c '\dt'` works too. Other
commands: `bin/db down`, `bin/db logs`, `bin/db exec <cmd>`.

Never add a `ports:` mapping to `compose.yaml`, and never install a host `psql`
client. Either one silently removes the restriction.

## Working here

- Keep local secrets in `.env`. It is gitignored and never committed.
- Never rewrite history or force push. If a task seems to need it, ask first.
- Keep commits focused, with a short bulleted description of what changed and why.
