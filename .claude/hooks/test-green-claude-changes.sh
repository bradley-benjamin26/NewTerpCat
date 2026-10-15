#!/bin/bash
# Self-check for green-claude-changes.sh: run it against a throwaway git repo.
set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/green-claude-changes.sh"
REPO="$(mktemp -d)"
trap 'rm -rf "$REPO"' EXIT
git -C "$REPO" init -q
printf 'export const a = 1;\n' > "$REPO/a.ts"
git -C "$REPO" add a.ts && git -C "$REPO" -c user.email=t@t -c user.name=t commit -qm init

run() { echo '{"tool_name":"Bash"}' | CLAUDE_PROJECT_DIR="$REPO" "$HOOK" 2>"$REPO/.err"; echo $?; }
fail=0
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1 (got $2, want $3)"; fail=1; }; }

check "untouched tree is silent" "$(run)" 0
printf 'export async function get(url) { return await fetch(url); }\n' >> "$REPO/a.ts"
check "new remote call without timeout is reported" "$(run)" 2
grep -q "ECO-BACK-06" "$REPO/.err"; check "report names the rule" $? 0
grep -q "a.ts" "$REPO/.err"; check "report names the file" $? 0
check "same lines are not reported twice" "$(run)" 0
printf 'export const b = 2;\n' >> "$REPO/a.ts"
check "a clean new line is silent" "$(run)" 0
printf 'export const c = await fetch("/x");\n' > "$REPO/new.ts"
check "an untracked new file is audited" "$(run)" 2
printf 'export const d = await fetch("/y");\n' > "$REPO/café.ts"
check "a file with a non-ASCII name is audited" "$(run)" 2
exit $fail
