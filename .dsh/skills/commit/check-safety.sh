#!/usr/bin/env bash
#
# Deterministic pre-commit safety scan for the `commit` skill.
#
# Scans exactly the paths that would be committed: every path that differs from
# HEAD plus every untracked, non-ignored path.
#
# Exit codes:
#   0  nothing unsafe found, safe to commit
#   1  unsafe paths found (printed as BLOCK/JUNK lines)
#   2  environment error (not a repo, missing git, etc.)
#
# Override the size threshold with MAX_BYTES (default 5 MiB).
# Override the reported file list with SCAN_PATHS (newline-separated), used by tests.

set -uo pipefail

MAX_BYTES="${MAX_BYTES:-5242880}"

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 2
}
cd "$root" || exit 2

work=$(mktemp -d) || exit 2
trap 'rm -rf "$work"' EXIT

list="$work/files.z"
block="$work/block"
junk="$work/junk"
: > "$block"
: > "$junk"

# --- Collect candidate paths ------------------------------------------------
if [ -n "${SCAN_PATHS:-}" ]; then
  printf '%s\n' "$SCAN_PATHS" | tr '\n' '\0' > "$list.tmp" && mv "$list.tmp" "$list"
elif git rev-parse --verify -q HEAD >/dev/null 2>&1; then
  { git diff --name-only -z HEAD; git ls-files -z --others --exclude-standard; } \
    | sort -zu > "$list"
else
  { git ls-files -z; git ls-files -z --others --exclude-standard; } | sort -zu > "$list"
fi

add_block() { printf 'BLOCK %s: %s\n' "$1" "$2" >> "$block"; }
add_junk()  { printf 'JUNK  %s: %s\n' "$1" "$2" >> "$junk"; }

# High-confidence secret content. Text files only (grep -I skips binaries).
SECRET_RE='-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'

while IFS= read -r -d '' path; do
  [ -f "$path" ] || continue
  base=${path##*/}

  # Template env files are meant to be committed.
  case "$base" in
    .env.example|.env.sample|.env.template|.env.dist) ;;
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|*.kdbx|id_rsa*|id_dsa*|id_ecdsa*|id_ed25519*|credentials|credentials.*|secrets|secrets.*|.netrc|.pypirc|.npmrc|*secret*.json)
      add_block secret-named "$path"
      continue
      ;;
  esac

  # Personal / local / generated files.
  case "$path" in
    .DS_Store|*/.DS_Store|Thumbs.db|*/Thumbs.db|*~|*.swp|*.swo|*.orig|*.rej|*.pyc|*.log|\
    */__pycache__/*|*/.venv/*|*/venv/*|*/node_modules/*|*/dist/*|*/build/*|.dsh/cache/*|\
    */.idea/*)
      add_junk local-or-generated "$path"
      continue
      ;;
  esac

  # Oversized files.
  size=$(wc -c < "$path" | tr -d ' ')
  if [ "${size:-0}" -gt "$MAX_BYTES" ]; then
    add_block large "$path ($size bytes > $MAX_BYTES)"
    continue
  fi

  # Secret-looking content.
  if grep -I -q -E -e "$SECRET_RE" "$path" 2>/dev/null; then
    add_block secret-content "$path"
    continue
  fi
done < "$list"

# --- Report -----------------------------------------------------------------
if [ -s "$block" ] || [ -s "$junk" ]; then
  echo "unsafe paths found:"
  cat "$block" "$junk" | LC_ALL=C sort
  echo
  [ -s "$block" ] && echo "BLOCK lines must be removed or unstage; JUNK lines belong in .gitignore."
  exit 1
fi

total=$(tr -cd '\0' < "$list" | wc -c | tr -d ' ')
echo "ok: $total path(s) scanned, nothing unsafe found"
exit 0
