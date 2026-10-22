#!/usr/bin/env bash
#
# Deterministic pre-commit safety scan for the `commit` skill.
#
# Scans exactly the paths that would be committed: every path that differs from
# HEAD plus every untracked, non-ignored path.
#
# Usage:
#   check-safety.sh                 report only
#   check-safety.sh --apply-ignore  gitignore name-based secrets and junk,
#                                   untrack them, re-scan, then report
#
# Exit codes:
#   0  nothing unsafe remains, safe to commit
#   1  unsafe paths remain (printed as BLOCK/JUNK lines)
#   2  environment error (not a repo, bad argument, etc.)
#
# Auto-fixable: `secret-named` and `local-or-generated`.
# Always blocking: `secret-content` and `large` — a real secret must be removed
# from the file, and an oversized file needs a human decision.

set -uo pipefail

MAX_BYTES="${MAX_BYTES:-5242880}"
APPLY=0

for arg in "$@"; do
  case "$arg" in
    --apply-ignore) APPLY=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "error: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 2
}
cd "$root" || exit 2

work=$(mktemp -d) || exit 2
trap 'rm -rf "$work"' EXIT

list="$work/files.z"
findings="$work/findings"
: > "$findings"

# High-confidence secret content. Text files only (grep -I skips binaries).
# The -e flag is required: the pattern starts with "--".
SECRET_RE='-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'

note() { printf '%s\t%s\t%s\n' "$1" "$2" "${3:-}" >> "$findings"; }

collect_paths() {
  if [ -n "${SCAN_PATHS:-}" ]; then
    printf '%s\n' "$SCAN_PATHS" | tr '\n' '\0' > "$list"
  elif git rev-parse --verify -q HEAD >/dev/null 2>&1; then
    { git diff --name-only -z HEAD; git ls-files -z --others --exclude-standard; } \
      | sort -zu > "$list"
  else
    { git ls-files -z; git ls-files -z --others --exclude-standard; } | sort -zu > "$list"
  fi
}

scan() {
  : > "$findings"
  while IFS= read -r -d '' path; do
    [ -f "$path" ] || continue
    base=${path##*/}

    # Template env files are meant to be committed.
    case "$base" in
      .env.example|.env.sample|.env.template|.env.dist) ;;
      .env|.env.*|*.pem|*.key|*.p12|*.pfx|*.kdbx|id_rsa*|id_dsa*|id_ecdsa*|id_ed25519*|credentials|credentials.*|secrets|secrets.*|.netrc|.pypirc|.npmrc|*secret*.json)
        note secret-named "$path"
        continue
        ;;
    esac

    # Personal / local / generated files. Each directory is matched both at the
    # root (.vscode/*) and nested (*/.vscode/*).
    case "$path" in
      .DS_Store|*/.DS_Store|Thumbs.db|*/Thumbs.db|*~|*.swp|*.swo|*.orig|*.rej|*.pyc|*.log|\
      .venv/*|*/.venv/*|venv/*|*/venv/*|__pycache__/*|*/__pycache__/*|\
      node_modules/*|*/node_modules/*|dist/*|*/dist/*|build/*|*/build/*|\
      .idea/*|*/.idea/*|.vscode/*|*/.vscode/*|.dsh/cache/*)
        note local-or-generated "$path"
        continue
        ;;
    esac

    # Oversized files.
    size=$(wc -c < "$path" | tr -d ' ')
    if [ "${size:-0}" -gt "$MAX_BYTES" ]; then
      note large "$path" "$size bytes > $MAX_BYTES"
      continue
    fi

    # Secret-looking content.
    if grep -I -q -E -e "$SECRET_RE" "$path" 2>/dev/null; then
      note secret-content "$path"
      continue
    fi
  done < "$list"
}

# Map a path to the narrowest practical .gitignore pattern.
pattern_for() {
  case "$1" in
    node_modules/*|*/node_modules/*) echo "node_modules/" ;;
    .venv/*|*/.venv/*)               echo ".venv/" ;;
    venv/*|*/venv/*)                 echo "venv/" ;;
    __pycache__/*|*/__pycache__/*)   echo "__pycache__/" ;;
    dist/*|*/dist/*)                 echo "dist/" ;;
    build/*|*/build/*)               echo "build/" ;;
    .idea/*|*/.idea/*)               echo ".idea/" ;;
    .vscode/*|*/.vscode/*)           echo ".vscode/" ;;
    .dsh/cache/*)                    echo ".dsh/cache/" ;;
    *) printf '%s\n' "$1" | sed 's/[*?[]/\\&/g' ;;
  esac
}

apply_ignores() {
  [ -s "$findings" ] || return 0

  patterns="$work/patterns"
  : > "$patterns"
  while IFS=$'\t' read -r kind path _; do
    case "$kind" in
      secret-named|local-or-generated) pattern_for "$path" >> "$patterns" ;;
    esac
  done < "$findings"
  LC_ALL=C sort -u "$patterns" -o "$patterns"

  [ -s "$patterns" ] || return 0

  if [ ! -f .gitignore ]; then
    printf '# Local, secret, and generated files\n' > .gitignore
  fi
  while IFS= read -r pat; do
    [ -n "$pat" ] || continue
    grep -Fqx -- "$pat" .gitignore 2>/dev/null || printf '%s\n' "$pat" >> .gitignore
  done < "$patterns"

  # Untrack anything that is now ignored but still in the index.
  while IFS=$'\t' read -r kind path _; do
    case "$kind" in
      secret-named|local-or-generated) ;; *) continue ;;
    esac
    if git ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
      git rm --cached -q -- "$path" 2>/dev/null || true
    fi
  done < "$findings"
}

report() {
  if [ -s "$findings" ]; then
    echo "unsafe paths found:"
    LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2 "$findings" \
      | while IFS=$'\t' read -r kind path detail; do
          case "$kind" in
            secret-named)         printf 'BLOCK secret-named: %s\n' "$path" ;;
            secret-content)       printf 'BLOCK secret-content: %s\n' "$path" ;;
            large)                printf 'BLOCK large: %s (%s)\n' "$path" "$detail" ;;
            local-or-generated)   printf 'JUNK  local-or-generated: %s\n' "$path" ;;
          esac
        done
    return 1
  fi
  return 0
}

collect_paths
scan

if [ "$APPLY" -eq 1 ] && [ -s "$findings" ]; then
  apply_ignores
  collect_paths
  scan
fi

if report; then
  total=$(tr -cd '\0' < "$list" | wc -c | tr -d ' ')
  echo "ok: $total path(s) scanned, nothing unsafe found"
  exit 0
fi

echo
if [ "$APPLY" -eq 1 ]; then
  echo "Remaining BLOCK lines need a human: remove the secret from the file, or approve the size."
else
  echo "Re-run with --apply-ignore to ignore secret-named and local/generated files, then commit the rest."
fi
exit 1
