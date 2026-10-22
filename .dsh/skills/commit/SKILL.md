---
name: commit
description: Commit the whole working tree as one commit with a concise bulleted message and no attribution. Never pushes or deploys.
---

# Commit

Turn the working tree into a single clean commit, leaving nothing behind.

## Steps

1. **Preflight.** Run `git status --short` and `git status -sb`.
   - Not a git repo → stop and report.
   - Detached HEAD → stop and report.
   - Clean tree with no untracked files → report "nothing to commit" and stop.

2. **Run the safety scan.** From the repo root, run the script next to this file,
   resolving its path from this skill's base directory:

   ```bash
   bash <skill-base-dir>/check-safety.sh
   ```

   It scans exactly the paths that would be committed and prints `BLOCK`/`JUNK`
   lines. Follow its verdict, do not re-judge it:

   - **Exit 0** → safe. Continue to step 3.
   - **Exit 1** → stop. Report every printed line to the user and commit nothing.
     Remove or unstage `BLOCK` paths; move `JUNK` paths to `.gitignore`
     (`git rm --cached` anything already tracked).
   - **Exit 2** → environment problem (not a repo, git missing). Report and stop.

   Raise the 5 MiB threshold with `MAX_BYTES=<bytes>` only when the user
   explicitly approves committing that specific large file.

   The scan is a guardrail, not a guarantee. Default to committing **all**
   working files, not just the ones you edited.

3. **Stage everything.** `git add -A`.

4. **Write the message.** A one-line imperative subject, a blank line, then a concise bulleted list:

   ```
   Add site launcher

   - Add launcher that opens saved sites in a new tab
   - Store favorites in the vault
   - Document setup in README
   ```

   - Group bullets by theme, roughly 3–5, rather than one per file.
   - Imperative mood, no trailing period, subject under 72 characters.
   - **No attribution.** Never add `Co-Authored-By`, `Signed-off-by`, "Generated with", emoji, or any mention of AI, agents, assistants, models, DeepSeek, this skill, or the tool/session that produced the change. The commit should read as ordinary human work.

5. **Commit.** `git commit -m "<subject>" -m "<bullets>"`. Run hooks normally; if a hook fails, fix the cause and retry — never `--no-verify`.

6. **Verify.** `git status --short` must print nothing. Report the short hash, subject, and file count.

## Never

- Push, pull, fetch, tag, or deploy anything.
- Rewrite history: `amend`, `rebase`, `reset --hard`, `filter-branch`.
- Commit secrets, credentials, or large binaries.
