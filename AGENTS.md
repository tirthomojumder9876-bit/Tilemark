# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

A mobile-first single-page app for a grid of favorite websites. Bookmarks live in
sections, open in a new tab, and can be dragged between sections.

## Setup

```bash
git config core.hooksPath .githooks   # once, after cloning
npm install
```

## Common Commands

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| API server (:3001) | `npm run server` |
| SPA dev server (:5173) | `npm run dev` |
| Build | `npm run build` |
| Test (all) | `npm test` |
| Test (single file) | `npx vitest run tests/order.test.ts` |
| Typecheck | `npm run typecheck` |
| Lint | none configured |
| Format | none configured |

## Repository Layout

```
src/                 SPA
  logic/             pure functions, unit tested
  components/        presentational React components
  App.tsx            state, data loading, drag and drop wiring
server/              Express API
  repo.ts            storage interface
  memory-repo.ts     in-memory storage (tests, dev without Docker)
  pg-repo.ts         Postgres storage
tests/               Vitest
.githooks/           git guards
bin/db               runs commands inside the database container
vault/               notes and spec
```

## Conventions

- **Language/style:** TypeScript strict mode, ES modules, explicit `.ts` extensions on
  imports used by the server (Node requires them; Vite tolerates them).
- **Logic vs components:** pure rules belong in `src/logic/` with tests. Components
  receive props and render; they do not fetch or validate.
- **Testing:** every pure function gets unit tests. `npm test` and `npm run typecheck`
  must pass before a commit.
- **Error handling:** the API returns `{ error }` or `{ errors: { field } }`; the client
  surfaces the message in the banner.

## Working Guidelines for Agents

- Read the relevant code before changing it. Do not guess at APIs.
- Keep diffs focused: no unrelated refactors, reformatting, or drive-by renames.
- Match existing patterns in the codebase over your own preferences.
- Verify changes with the project's tests, lint, and typecheck before declaring done.
- Do not commit, push, or open pull requests unless explicitly asked.
- Do not add dependencies without checking whether the project already provides an equivalent.
- Never commit secrets, credentials, or machine-specific paths.

## Git

- **Branch naming:** TODO
- **Commit messages:** Use the `commit` skill (`.dsh/skills/commit`).
- **Before committing:** run `bash .dsh/skills/commit/check-safety.sh --apply-ignore`.

### Git safety

`.githooks/` is enabled through `core.hooksPath` and refuses history rewriting and
force pushes:

- `git rebase` — refused by `pre-rebase`
- `git commit --amend` — refused (non-fast-forward ref update)
- `git reset --hard <older>`, `git reset --soft` — refused
- `git branch -D` — refused (ref deletion)
- `git push --force`, `git push origin --delete` — refused by `pre-push`

Never run `reset --hard`, `clean -fdx`, `checkout -- .`, `restore`, `stash drop`, or
`push --force`. If a task appears to need one, stop and ask.

Caveat: `git reset --hard` rewrites the working tree before it touches the ref, so
the hook aborts the *history* change but tracked files may already be reverted.
Recover with `git checkout -- .` while HEAD is still intact. Hooks are also
bypassable (`git -c core.hooksPath=reset`, `--no-verify`), so treat them as a
guardrail, not a sandbox.

## Database

- Postgres runs in Docker and is published on `127.0.0.1:5436` (loopback only).
  Host tools connect there; the app container uses `db:5432` internally.
- Keep the binding on `127.0.0.1`. Changing it to `0.0.0.0` exposes the database
  to the local network.
- `bin/db` remains the way to run commands *inside* the container (`bin/db psql`).
- If Docker is missing or not running, report it. Do not fall back to an
  unrelated host database.

## Gotchas

TODO: Non-obvious constraints, required local services, slow or flaky tests,
generated files that must not be hand-edited, platform-specific quirks.
