#!/bin/bash
# PostToolUse hook (Write|Edit|MultiEdit|Bash): audits lines added to the working tree since the
# last check, whatever tool wrote them, so shell edits (heredocs, sed, scripts) are audited too.
#
# Only lines added since HEAD (or new untracked files) are audited, and each line only once:
# lines already checked are kept in .git/green-claude-seen/. Silent when nothing is found;
# exit 2 hands the report back to Claude.
#
# Self-check: .claude/hooks/test-green-claude-changes.sh

set -uo pipefail

# shortcut: picks the last version dir by name sort; fine until versions reach 10.x
AUDIT="$(ls -d "$HOME"/.claude/plugins/cache/green-claude/green-claude/*/skills/green-claude/scripts/eco-audit.sh 2>/dev/null | tail -1)"
[ -x "$AUDIT" ] || exit 0  # plugin absent: never break the session
command -v jq >/dev/null 2>&1 || exit 0
cat >/dev/null  # hook input is not needed; the working tree says what changed

cd "$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
source "$(dirname "$AUDIT")/audit-common.sh"
load_audit_extensions || exit 0

SEEN="$(git rev-parse --absolute-git-dir)/green-claude-seen"
mkdir -p "$SEEN"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
REPORTS=""

while IFS= read -r f; do
    key="$SEEN/$(printf '%s' "$f" | shasum | cut -c1-16)"
    if [ ! -f "$f" ] || ! is_auditable_file "$f"; then
        continue
    fi
    if git ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
        added="$(git diff -U0 HEAD -- "$f" | grep '^+' | grep -v '^+++ ' | cut -c2-)"
    else
        added="$(cat "$f")"
    fi
    if [ -z "$added" ]; then
        rm -f "$key"  # file back to HEAD (e.g. committed): start fresh next time
        continue
    fi
    if [ -f "$key" ]; then
        new="$(grep -vxF -f "$key" <<<"$added")"
    else
        new="$added"
    fi
    printf '%s\n' "$added" > "$key"
    [ -n "$new" ] || continue

    printf '%s\n' "$new" > "$TMP/${f##*/}"
    # Relative paths in the content resolve from the real file's directory.
    report="$(GREEN_CLAUDE_BASE_DIR="$(dirname "$f")" GREEN_CLAUDE_SOURCE_FILE="$f" "$AUDIT" "$TMP/${f##*/}" 2>/dev/null)"
    grep -q '^\[' <<<"$report" && REPORTS+="── $f"$'\n'"$report"$'\n\n'
done < <(git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard)

[ -n "$REPORTS" ] || exit 0
cat >&2 <<EOF
[Green Claude] Eco-design patterns in lines just added:

$REPORTS
Fix what is relevant (High impact first). If a flag does not apply here, say so in one sentence
and move on: these rules must never block a legitimate request.
EOF
exit 2
