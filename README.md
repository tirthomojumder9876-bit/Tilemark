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

That is the whole setup. There are no dependencies or build steps yet.

## Working here

- Keep local secrets in `.env`. It is gitignored and never committed.
- Never rewrite history or force push. If a task seems to need it, ask first.
- Keep commits focused, with a short bulleted description of what changed and why.
