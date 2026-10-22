# AGENTS.md

Guidance for AI coding agents working in this repository.

> **Status:** This is a starter template. The project hasn't been initialized yet, so
> sections marked `TODO` contain placeholders. Replace them with facts as the repo takes shape.

## Project Overview

TODO: One or two sentences on what this project does and who uses it.

## Setup

TODO: How to get a working local environment.

```bash
# install dependencies
# configure environment (.env, secrets, local services)
# initialize database / fixtures
```

## Common Commands

| Task | Command |
| --- | --- |
| Install | `TODO` |
| Dev server | `TODO` |
| Build | `TODO` |
| Test (all) | `TODO` |
| Test (single file) | `TODO` |
| Lint | `TODO` |
| Format | `TODO` |
| Typecheck | `TODO` |

## Repository Layout

TODO: Describe the top-level directories and what belongs in each.

```
.
├── TODO/
└── TODO/
```

## Conventions

- **Language/style:** TODO (e.g. TypeScript strict mode, PEP 8, gofmt).
- **Formatting:** Run the formatter before committing; do not hand-format.
- **Imports:** TODO (ordering, absolute vs relative paths).
- **Naming:** TODO (files, components, tests).
- **Tests:** Add or update tests for behavior changes. Bug fixes should include a
  regression test when practical.
- **Error handling:** Prefer explicit handling over silent fallbacks; never swallow errors.

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
- **Commit messages:** TODO (e.g. Conventional Commits: `feat:`, `fix:`, `docs:`).
- **Before committing:** tests pass, lint clean, no stray debug output.

## Gotchas

TODO: Non-obvious constraints, required local services, slow or flaky tests,
generated files that must not be hand-edited, platform-specific quirks.
