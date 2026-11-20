#!/usr/bin/env bash
# T905: the duplicate-logic check (scripts/dupscan.mjs) refuses a NEW copy of a formula and passes without it.
# A scratch tree holds one clean engine file and an empty allow-list; a second file carrying a driver-count
# formula must fail the run naming that file, and the shipped allow-list must pass on this repo.
# T934 (John, 19 Nov 2026: "remove the dupe and fix the guardrail"): the scratch tree is a git repository, because the
# check compares the allow-list with the one on the base commit (--base): the list may only shrink. Each kind of sum
# declares its home in the engine (--homes); a match inside its home is not a copy.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JSCPD="${DUPSCAN_JSCPD:-$REPO/node_modules/.bin/jscpd}"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dupscan-test.XXXXXX")" && [ -d "$SCRATCH" ] \
  || { echo "dupscan.test: cannot make a scratch directory under ${TMPDIR:-/tmp}; nothing tested" >&2; exit 2; }
trap 'rm -rf "$SCRATCH"' EXIT
# T934 review 2: a failed setup step stops the test at once (exit 2), never runs the cases against a half-made tree.
setup_failed() { echo "dupscan.test: scratch setup failed: $1; nothing tested" >&2; exit 2; }
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

g() { git -C "$SCRATCH" -c user.name=test -c user.email=test@example.invalid -c commit.gpgsign=false "$@"; }
mkdir -p "$SCRATCH/packages/design/engine/array" || setup_failed "mkdir"
printf 'export const area = (w: number, h: number): number => w + h;\n' > "$SCRATCH/packages/design/engine/clean.ts" || setup_failed "clean.ts"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts" || setup_failed "home.ts"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json" || setup_failed "homes.json"
echo '{}' > "$SCRATCH/allow.json" || setup_failed "allow.json"
# T934 review 3: a "was" re-key is allowed only when the pair is in the reviewed re-key mapping, generated from the base source.
echo '{"pairs": {}}' > "$SCRATCH/rekey.json" || setup_failed "rekey.json"
g init -q -b main || setup_failed "git init"
[ "$(g rev-parse --show-toplevel)" = "$(cd "$SCRATCH" && pwd -P)" ] || setup_failed "the scratch git repository is not $SCRATCH"
# base: the allow-list as it is on the base commit (tag base); the check compares the working allow-list with it
set_base() { g add -A > /dev/null && g commit -q --allow-empty -m base && g tag -f base > /dev/null; }
set_base || setup_failed "first base commit"
run() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --rekey "$SCRATCH/rekey.json" --base base 2>&1; }
# make_rekey: the re-key mapping (old key -> new key) generated from the tree as it is now (call it on the base state)
make_rekey() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --write-rekey "$SCRATCH/rekey.json" > /dev/null 2>&1 \
  || { echo "dupscan.test: --write-rekey failed" >&2; echo '{"pairs": {}}' > "$SCRATCH/rekey.json"; }; }

out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a scratch tree without the formula passes, its home's own line included (exit 0)" || bad "clean tree should pass, got exit $rc: $out"

printf 'export const perDriver = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/newcopy.ts' <<< "$out"; } && ok "a new formula copy is refused (exit 1) and named" || bad "new copy should exit 1 naming newcopy.ts, got exit $rc"
grep -q 'call packages/design/engine/array/home.ts:eachOfN' <<< "$out" && ok "the refusal names the kind's home to call" || bad "refusal should name the home eachOfN: $out"

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "removing the copy passes again (exit 0)" || bad "after removal should pass, got exit $rc"

# T934: the home. The same text inside the declared home function passes; outside it (another function in the same file,
# or another file) it fails.
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\nexport function other(Vb: number, n: number): number {\n  return Vb / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/array/home.ts:5' <<< "$out" && ! grep -q 'home.ts:2' <<< "$out"; } \
  && ok "the same sum in another function of the home's file fails, the home's own line does not" || bad "line 5 (other) should fail and line 2 (eachOfN) pass, got exit $rc: $out"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"

echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:gone"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:gone' <<< "$out"; } && ok "a declared home that does not exist fails (exit 1)" || bad "missing home should exit 1 naming it, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/ui/src/x.ts"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/' <<< "$out"; } && ok "a home outside the engine fails (exit 1)" || bad "home outside engine should exit 1, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json"

# T934 review (Codex, 19 Nov 2026, finding 1): a home is one named function, never a whole file; the name is matched
# exactly, never as a pattern; only the function's own text is its home, not code after its closing brace.
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home packages/design/engine/array/home.ts names no function' <<< "$out"; } \
  && ok "a home naming a whole file is refused (exit 1)" || bad "whole-file home should exit 1 saying it names no function, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:e.*"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:e.\*: not declared there' <<< "$out"; } \
  && ok "a home name is matched exactly, not as a pattern (e.* is not eachOfN) (exit 1)" || bad "home name e.* should exit 1 as not declared, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOf"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:eachOf: not declared there' <<< "$out"; } \
  && ok "a home name that is only the start of a declared name is refused (exit 1)" || bad "home name eachOf should exit 1 as not declared, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json"
printf 'export function eachOfN(whole: number, n: number): number { return whole / n; } export const leak = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/array/home.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/array/home.ts:1' <<< "$out"; } \
  && ok "a sum after the home's closing brace on the same line fails (exit 1)" || bad "code after the home's closing brace should exit 1 naming home.ts:1, got exit $rc: $out"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"

# T934 review (finding 4): a division by the driver count followed by "+" is a driver-count sum too.
printf 'export const rac = (re: number, n: number, rs: number): number => re / n + rs;\n' > "$SCRATCH/packages/design/engine/plus.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'driver-count-scaling (engine) packages/design/engine/plus.ts:1' <<< "$out"; } \
  && ok "a driver-count division followed by + (re / n + rs) is found (exit 1)" || bad "re / n + rs should exit 1 naming plus.ts:1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/plus.ts"

# T934 review (finding 3): a formula line's key drops its comments and keeps its literals exactly: a "//" inside a string,
# a regular expression or a nested template is not a comment, and spaces inside a string are not folded.
sig_keys() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --rekey "$SCRATCH/rekey.json" --base base --report "$SCRATCH/r.json" > /dev/null 2>&1
  node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).findings.filter(f => f.kind === "signature").map(f => f.key).sort().join("\n"))' "$SCRATCH/r.json"; }
cat > "$SCRATCH/packages/design/engine/keys.ts" << 'EOF'
export const a = (Vb: number, n: number): number => Vb / n; // one driver's share
export const b = (Vb: number, n: number): string => 'http://x  y' + (Vb / n);
export const c = (Vb: number, n: number): boolean => /\/\/ no/.test(String(Vb / n));
export const d = (Vb: number, n: number): string => `a ${`// in`} b` + (Vb / n);
EOF
keys="$(sig_keys)"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const a = (Vb: number, n: number): number => Vb / n;' <<< "$keys" \
  && ok "a formula line's key leaves out its trailing comment" || bad "key of line a should have no comment: $keys"
grep -qxF "sig|driver-count-scaling|packages/design/engine/keys.ts|export const b = (Vb: number, n: number): string => 'http://x  y' + (Vb / n);" <<< "$keys" \
  && ok "a formula line's key keeps a // inside a string and the string's own spaces" || bad "key of line b should keep 'http://x  y': $keys"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const c = (Vb: number, n: number): boolean => /\/\/ no/.test(String(Vb / n));' <<< "$keys" \
  && ok "a formula line's key keeps a // inside a regular expression" || bad "key of line c should keep the regex: $keys"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const d = (Vb: number, n: number): string => `a ${`// in`} b` + (Vb / n);' <<< "$keys" \
  && ok "a formula line's key keeps a // inside a nested template" || bad "key of line d should keep the nested template: $keys"
rm "$SCRATCH/packages/design/engine/keys.ts"

# T911 (QO949): a consolidated copy stays in the allow-list, marked resolved and resolved to the engine function; it
# never allows its key again, and an allowed entry whose copy is gone is reported and passes (T941).
COPY_LINE='export const perDriver = (Vb: number, n: number): number => Vb / n;'
KEY="sig|driver-count-scaling|packages/design/engine/newcopy.ts|$COPY_LINE"
resolved_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/sealedResonance.ts:arrayVas", resolved_by: "T902", ruling: "QO949"}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }
allowed_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }

# T934: the ratchet. A new allowed entry is refused: the list only shrinks.
allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry: $KEY" <<< "$out"; } \
  && ok "a new entry on the known-copies list is refused (exit 1) by the ratchet, naming its key" || bad "new list entry should exit 1 with the ratchet's 'new entry: <key>', got exit $rc"

# T934 review (finding 2): the reason "help text, no code" is checked, not trusted. Executable code with that reason is
# refused; the same words inside a string (help text) are accepted.
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "help text, no code (John, QO950)", where: "packages/design/engine/newcopy.ts:1", count: 1}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its reason says help text, but the match is code, not inside a string or comment): $KEY" <<< "$out"; } \
  && ok "a new entry for executable code with the reason \"help text, no code\" is refused (exit 1), naming its key" || bad "help-text reason on code should exit 1 naming the key, got exit $rc: $out"
HELP_LINE="export const HELP = 'One driver of the array gets Vb / n, as WinISD shows it';"
HELP_KEY="sig|driver-count-scaling|packages/design/engine/help.ts|$HELP_LINE"
rm "$SCRATCH/packages/design/engine/newcopy.ts"; printf '%s\n' "$HELP_LINE" > "$SCRATCH/packages/design/engine/help.ts"
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "help text, no code (John, QO950)", where: "packages/design/engine/help.ts:1", count: 1}}, null, 1));' "$HELP_KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a new help-text entry whose match lies inside a string is accepted (exit 0)" || bad "help text in a string should pass, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/help.ts"; printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"

allowed_allow; set_base   # from here on the entry is on the base list
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "an allowed copy that is still there passes (exit 0)" || bad "allowed copy should pass, got exit $rc: $out"

node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 2}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  count raised from 1 to 2: $KEY" <<< "$out"; } \
  && ok "raising an entry's count is refused (exit 1) by the ratchet, naming its key" || bad "count raised should exit 1 with 'count raised from 1 to 2: <key>', got exit $rc: $out"

echo '{}' > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  deleted (never delete an entry: mark it resolved): $KEY" <<< "$out"; } && ok "deleting an entry is refused (exit 1)" || bad "deleted entry should exit 1, got exit $rc: $out"
allowed_allow

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 0 ] && grep -q 'gone with this change' <<< "$out"; } && ok "an allowed entry whose copy is gone passes (exit 0), reported gone with this change (T941, QO963: replaces the old 'fails until it is marked resolved')" || bad "gone allowed entry should exit 0 reporting it gone, got exit $rc: $out"

resolved_allow
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a resolved entry whose copy is gone passes (exit 0)" || bad "resolved entry with its copy absent should pass, got exit $rc: $out"

printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'consolidated into packages/design/engine/sealedResonance.ts:arrayVas by T902; call packages/design/engine/sealedResonance.ts:arrayVas' <<< "$out"; } \
  && ok "a resolved copy that reappears fails (exit 1) naming the function to call" || bad "reappearing resolved copy should exit 1 naming arrayVas and T902, got exit $rc"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

resolved_allow; set_base
allowed_allow
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved on the base, unresolved here: $KEY" <<< "$out"; } && ok "un-resolving a resolved entry is refused (exit 1)" || bad "un-resolving should exit 1, got exit $rc: $out"

node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, resolved: true}}));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'resolved_to' <<< "$out"; } && ok "a resolved entry without resolved_to, resolved_by and ruling is refused (exit 1)" || bad "incomplete resolved entry should exit 1 naming resolved_to, got exit $rc: $out"

# T934 review (finding 2): a resolved entry's history is never replaced: not by a new resolved entry naming it in "was",
# and not by rewriting its resolved_to, resolved_by or ruling.
NEWKEY="sig|driver-count-scaling|packages/design/engine/newcopy.ts|export const perDriver = (Vb: number, n: number): number => Vb / n; "
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o,
  resolved: true, resolved_to: "packages/design/engine/elsewhere.ts:other", resolved_by: "T999", ruling: "QO949"}}));' "$NEWKEY" "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved entry replaced (a resolved entry's history is never replaced): $KEY" <<< "$out"; } \
  && ok "a resolved entry replaced through another entry's \"was\" is refused (exit 1)" || bad "replacing a resolved entry via was should exit 1 naming it, got exit $rc: $out"
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/elsewhere.ts:other", resolved_by: "T902", ruling: "QO949"}}));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved entry rewritten (resolved_to changed): $KEY" <<< "$out"; } \
  && ok "rewriting a resolved entry's resolved_to is refused (exit 1)" || bad "changed resolved_to should exit 1 naming the key, got exit $rc: $out"

# T934: a copy's key ignores comments and whitespace, so rewording a comment inside a known copy keeps its key; an entry
# re-keyed from the old form names it in "was" and is not a new entry.
echo '{}' > "$SCRATCH/allow.json"; set_base
block() { cat << EOF
export function mix(volume: number, area: number, length: number, count: number): number {
  const total = volume * area + length * count - volume / area + length / count;
  const other = total * volume + area * length - count / total + volume / length;
  // $1
  const third = other * total + volume * area - length / other + count / volume; /* $1 */
  const fourth = third * other + total * volume - area / third + length / count;
  return fourth + third + other + total + volume + area + length + count;
}
EOF
}
# jscpd itself matches comments, so a comment reworded inside a known copy is reworded in both places
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
copy_keys() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --rekey "$SCRATCH/rekey.json" --base base --report "$SCRATCH/r.json" > /dev/null 2>&1
  node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).findings.filter(f => f.kind === "copy").map(f => f.key).sort().join("\n"))' "$SCRATCH/r.json"; }
before="$(copy_keys)"
block 'the comment, reworded at length' > "$SCRATCH/packages/design/engine/a.ts"; block 'the comment, reworded at length' > "$SCRATCH/packages/design/engine/b.ts"
after="$(copy_keys)"
{ [ -n "$before" ] && [ "$before" = "$after" ]; } && ok "rewording the comments inside a copy keeps its key" || bad "copy key should not change with comments: before [$before] after [$after]"
sed -i 's/volume \* area + length/volume * area * length/' "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"
changed="$(copy_keys)"
{ [ -n "$changed" ] && [ "$changed" != "$before" ]; } && ok "changing the code inside a copy changes its key" || bad "code change should change the copy key: [$before] -> [$changed]"
# A "/*" inside a regular expression is not a comment: code after it still counts for the key.
rx_block() { cat << EOF
export function scan(volume: number, area: number, length: number, count: number): number {
  const re = /a\/*b/;
  const total = volume * area + length * count - volume / area + length / count;
  const other = total * volume + area * length - count / total + volume / length;
  const third = other * total + volume * area - length / other + count / volume;
  const fourth = third * other + total * volume - area / third + length / count + (re.test('x') ? 1 : 0);
  return fourth + third + other + total + volume + area + length + $1;
}
EOF
}
rx_block count > "$SCRATCH/packages/design/engine/a.ts"; rx_block count > "$SCRATCH/packages/design/engine/b.ts"
before="$(copy_keys)"
rx_block 'count * 2' > "$SCRATCH/packages/design/engine/a.ts"; rx_block 'count * 2' > "$SCRATCH/packages/design/engine/b.ts"
after="$(copy_keys)"
{ [ -n "$before" ] && [ -n "$after" ] && [ "$before" != "$after" ]; } \
  && ok "a /* inside a regular expression does not hide the code after it from the copy's key" || bad "code after /a\\/*b/ should change the key: [$before] -> [$after]"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"
# T934 review (finding 3; review 2 option A): the usual edit touches one side only. A comment reworded in one of the two copies keeps the key,
# whichever side it is.
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
before="$(copy_keys)"
block 'the comment, reworded on this side only' > "$SCRATCH/packages/design/engine/a.ts"
after_a="$(copy_keys)"
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'the comment, reworded on this side only' > "$SCRATCH/packages/design/engine/b.ts"
after_b="$(copy_keys)"
{ [ -n "$before" ] && [ "$before" = "$after_a" ] && [ "$before" = "$after_b" ]; } \
  && ok "rewording a comment in ONE of the two copies keeps the copy's key (either side)" || bad "one-sided comment edit should keep the key: before [$before] a [$after_a] b [$after_b]"
# T934 review 2 ("was" identity, copies): a copy's previous key is derived from the same copy (the previous detector and
# hash); a re-key naming it passes, and a different copy between the same two files cannot take the allowance over.
echo '{}' > "$SCRATCH/allow.json"; set_base
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
copy_field() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).findings.filter(f => f.kind === "copy").map(f => f[process.argv[2]]).join("\n"))' "$SCRATCH/r.json" "$1"; }
copy_keys > /dev/null; A_NEW="$(copy_field key)"; A_OLD="$(copy_field oldKey)"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$A_OLD" > "$SCRATCH/allow.json"; set_base; make_rekey
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$A_NEW" "$A_OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ -n "$A_OLD" ] && [ "$A_OLD" != "$A_NEW" ] && [ "$rc" = 0 ]; } && ok "a copy re-keyed with \"was\" as the reviewed mapping (made from the base source) says passes (exit 0)" || bad "copy re-key should pass (old [$A_OLD] new [$A_NEW]), got exit $rc: $out"
rx_block count > "$SCRATCH/packages/design/engine/a.ts"; rx_block count > "$SCRATCH/packages/design/engine/b.ts"
copy_keys > /dev/null; B_NEW="$(copy_field key)"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$B_NEW" "$A_OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ -n "$B_NEW" ] && [ "$rc" = 1 ] && grep -qF "  new entry (its \"was\" and this key are not a pair in the reviewed re-key mapping; a re-key moves the same finding, unchanged since the base): $B_NEW" <<< "$out"; } \
  && ok "a different copy between the same two files cannot take over a removed copy's entry through \"was\" (exit 1)" || bad "different copy via was should exit 1 naming its key, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"
echo '{}' > "$SCRATCH/allow.json"; set_base

OLD='sig|driver-count-scaling|packages/design/engine/newcopy.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD" > "$SCRATCH/allow.json"; set_base; make_rekey
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
# T934 review 2 (finding: "was" identity): an old key nobody can derive from this finding is not a re-key of it. Was
# "an entry re-keyed with was naming its old key on the base passes (exit 0)"; the fabricated old key now fails.
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" and this key are not a pair in the reviewed re-key mapping; a re-key moves the same finding, unchanged since the base): $KEY" <<< "$out"; } \
  && ok "an entry re-keyed with \"was\" naming an old key that is not this finding's previous key is refused (exit 1), naming the key" || bad "fabricated was should exit 1 naming the key, got exit $rc: $out"
# The real re-key: the base entry is the line's key in the previous form (trailing comment included); the new key drops
# the comment and names that old key in "was".
COMMENT_LINE='export const perDriver = (Vb: number, n: number): number => Vb / n;   // one driver'"'"'s share'
OLD_FORM="sig|driver-count-scaling|packages/design/engine/newcopy.ts|export const perDriver = (Vb: number, n: number): number => Vb / n; // one driver's share"
printf '%s\n' "$COMMENT_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD_FORM" > "$SCRATCH/allow.json"; set_base; make_rekey
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD_FORM" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "an entry re-keyed with \"was\" as the reviewed mapping (made from the base source) says passes (exit 0)" || bad "real re-key should pass, got exit $rc: $out"
# A different line in the same file cannot take over the old line's allowance.
printf '%s\n' 'export const other = (Vb: number, n: number): number => Vb / n + 0;' > "$SCRATCH/packages/design/engine/newcopy.ts"
OTHER_KEY='sig|driver-count-scaling|packages/design/engine/newcopy.ts|export const other = (Vb: number, n: number): number => Vb / n + 0;'
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$OTHER_KEY" "$OLD_FORM" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF "  new entry (its \"was\" and this key are not a pair in the reviewed re-key mapping; a re-key moves the same finding, unchanged since the base): $OTHER_KEY" <<< "$out"; } \
  && ok "a different line in the same file cannot take over a removed line's entry through \"was\" (exit 1)" || bad "different line via was should exit 1 naming its key, got exit $rc: $out"
echo '{"pairs": {}}' > "$SCRATCH/rekey.json"
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}, [k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "is not an unresolved base entry this one replaces): $KEY" <<< "$out"; } \
  && ok "a \"was\" whose old key is still listed is a new entry and is refused (exit 1)" || bad "was with the old key kept should exit 1 naming the key, got exit $rc: $out"
# T934 review (finding 2): "was" moves one finding to its new key: the same rule and the same file (a copy: the same two
# files), one new key for one old key. An allowance is never carried to another rule or another file.
OTHER_RULE='sig|decibel|packages/design/engine/newcopy.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OTHER_RULE" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OTHER_RULE" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is another rule or another file, not this finding's old key): $KEY" <<< "$out"; } \
  && ok "a \"was\" naming another rule's entry is refused (exit 1)" || bad "was across rules should exit 1 naming the key, got exit $rc: $out"
OTHER_FILE='sig|driver-count-scaling|packages/design/engine/elsewhere.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OTHER_FILE" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OTHER_FILE" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is another rule or another file, not this finding's old key): $KEY" <<< "$out"; } \
  && ok "a \"was\" naming another file's entry is refused (exit 1)" || bad "was across files should exit 1 naming the key, got exit $rc: $out"
SECOND_LINE='export const perDriver2 = (Vb: number, n: number): number => Vb / n;'
KEY2="sig|driver-count-scaling|packages/design/engine/newcopy.ts|$SECOND_LINE"
printf '%s\n%s\n' "$COPY_LINE" "$SECOND_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, k2, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}, [k2]: {reason: "baseline", where: "x:2", count: 1, was: o}}));' "$KEY" "$KEY2" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is claimed by 2 entries; one old key moves to one new key)" <<< "$out"; } \
  && ok "one old key claimed by two entries' \"was\" is refused (exit 1)" || bad "two entries with one was should exit 1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

# T934 review 2: a resolved entry keeps its key as recorded (history), in the previous key form; the copy coming back is
# still reported as consolidated, naming the function to call.
printf '%s\n' "$COMMENT_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/sealedResonance.ts:arrayVas", resolved_by: "T902", ruling: "QO949"}}));' "$OLD_FORM" > "$SCRATCH/allow.json"; set_base
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'consolidated into packages/design/engine/sealedResonance.ts:arrayVas by T902; call packages/design/engine/sealedResonance.ts:arrayVas' <<< "$out" && ! grep -q 'new duplicated logic' <<< "$out"; } \
  && ok "a copy resolved under its previous key form that comes back is reported as consolidated, naming the function (exit 1)" || bad "returning copy with a previous-form resolved key should exit 1 naming arrayVas, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

# T934 review 3 (Codex, finding 1): the previous key form folds the spaces inside a string, so a line changed since the base
# ('a  b' to 'a b') has the same previous-form key, and that key, read as a key of the new form, names the changed line. The
# reviewed mapping (made from the BASE source) moves the base entry to the base line's own new key, so the old key allows
# nothing: the changed line is refused, whether the entry is kept as it was or claimed through "was".
STR2="export const s = (Vb: number, n: number): string => 'a  b' + (Vb / n);"
STR1="export const s = (Vb: number, n: number): string => 'a b' + (Vb / n);"
STR_OLD="sig|driver-count-scaling|packages/design/engine/str.ts|$STR1"
STR2_KEY="sig|driver-count-scaling|packages/design/engine/str.ts|$STR2"
printf '%s\n' "$STR2" > "$SCRATCH/packages/design/engine/str.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$STR_OLD" > "$SCRATCH/allow.json"; set_base; make_rekey
printf '%s\n' "$STR1" > "$SCRATCH/packages/design/engine/str.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF "  listed under a previous-form key the reviewed re-key mapping moves to $STR2_KEY (list the entry under that key, \"was\": this one): $STR_OLD" <<< "$out" \
  && grep -q 'new duplicated logic' <<< "$out"; } \
  && ok "a line changed since the base ('a  b' to 'a b', one previous-form key) is not allowed by the base entry (exit 1)" || bad "changed string kept under the base entry should exit 1 naming the key, got exit $rc: $out"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$STR_OLD" "$STR_OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF "moves to $STR2_KEY" <<< "$out"; } \
  && ok "the same changed line claimed through \"was\" is refused (exit 1)" || bad "changed string via was should exit 1, got exit $rc: $out"
printf '%s\n' "$STR2" > "$SCRATCH/packages/design/engine/str.ts"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$STR2_KEY" "$STR_OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "the unchanged line ('a  b') re-keyed as the mapping says passes (exit 0)" || bad "unchanged string re-keyed per mapping should pass, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/str.ts"; echo '{}' > "$SCRATCH/allow.json"; echo '{"pairs": {}}' > "$SCRATCH/rekey.json"; set_base

# T934 review 3 (finding 1, copies): a copy that grew since the base (comment-insensitive matching joins more shared code
# to it) still contains the base's smaller copy on both sides, but it is not the same finding unless the mapping says so.
# Base: the shared block, then a comment that differs and a short tail that differs. Head: the tails are made the same, so
# the comment-insensitive copy grows over them while the previous form's copy (stopped by the comment) is unchanged.
grow_block() { block 'one comment'; printf '// note on side %s\nexport const tail = (volume: number, area: number): number => volume * area - %s;\n' "$1" "$2"; }
grow_block a 'area / volume' > "$SCRATCH/packages/design/engine/a.ts"; grow_block b 'volume / area' > "$SCRATCH/packages/design/engine/b.ts"
copy_keys > /dev/null; G_OLD="$(copy_field oldKey)"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$G_OLD" > "$SCRATCH/allow.json"; set_base; make_rekey
grow_block a 'area / volume + volume * volume - area * area' > "$SCRATCH/packages/design/engine/a.ts"; grow_block b 'area / volume + volume * volume - area * area' > "$SCRATCH/packages/design/engine/b.ts"
copy_keys > /dev/null; G_NEW="$(copy_field key)"; G_NEW_OLD="$(copy_field oldKey)"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$G_NEW" "$G_OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ -n "$G_OLD" ] && [ "$G_NEW_OLD" = "$G_OLD" ] && [ "$rc" = 1 ] && grep -qF "  new entry (its \"was\" and this key are not a pair in the reviewed re-key mapping; a re-key moves the same finding, unchanged since the base): $G_NEW" <<< "$out"; } \
  && ok "a copy grown since the base, containing the base's copy on both sides, cannot take its allowance through \"was\" (exit 1)" || bad "grown copy via was should exit 1 naming its key (old [$G_OLD], grown copy's previous form [$G_NEW_OLD]), got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"; echo '{}' > "$SCRATCH/allow.json"; echo '{"pairs": {}}' > "$SCRATCH/rekey.json"; set_base

# T934 review 3 (finding 3): a comment inserted where there was no space (f(/* note */x) for f(x)) keeps the key, of a formula
# line and of a copy, whichever side of the copy it is on.
printf '%s\n' 'export const m = (Vb: number, n: number): number => Math.max(Vb / n, 0);' > "$SCRATCH/packages/design/engine/m.ts"
k_plain="$(sig_keys)"
printf '%s\n' 'export const m = (Vb: number, n: number): number => Math.max(/* note */Vb / n, 0);' > "$SCRATCH/packages/design/engine/m.ts"
k_note="$(sig_keys)"
{ [ -n "$k_plain" ] && [ "$k_plain" = "$k_note" ]; } && ok "a comment inserted with no space around it keeps a formula line's key" || bad "inline comment should keep the key: [$k_plain] vs [$k_note]"
rm "$SCRATCH/packages/design/engine/m.ts"
note_block() { cat << EOF
export function mix(volume: number, area: number, length: number, count: number): number {
  const total = volume * area + length * count - volume / area + length / count;
  const other = total * volume + area * length - count / total + volume / length;
  const third = other * total + volume * area - length / other + count / volume;
  const fourth = third * other + total * volume - area / third + length / count;
  return Math.abs($1fourth) + third + other + total + volume + area + length + count;
}
EOF
}
note_block '' > "$SCRATCH/packages/design/engine/a.ts"; note_block '' > "$SCRATCH/packages/design/engine/b.ts"
before="$(copy_keys)"
note_block '/* note */' > "$SCRATCH/packages/design/engine/a.ts"
after_a="$(copy_keys)"
note_block '' > "$SCRATCH/packages/design/engine/a.ts"; note_block '/* note */' > "$SCRATCH/packages/design/engine/b.ts"
after_b="$(copy_keys)"
{ [ -n "$before" ] && [ "$before" = "$after_a" ] && [ "$before" = "$after_b" ]; } \
  && ok "a comment inserted with no space around it, in one copy, keeps the copy's key (either side)" || bad "inline comment in one copy should keep the key: before [$before] a [$after_a] b [$after_b]"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"

# T934 review 3 (finding 3): a consolidated copy that comes back is reported even when an active entry under its other key
# form would allow it: recurrence is checked before the allowances.
printf '%s\n' "$COMMENT_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o, k] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/sealedResonance.ts:arrayVas", resolved_by: "T902", ruling: "QO949"}, [k]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD_FORM" "$KEY" > "$SCRATCH/allow.json"; set_base
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'consolidated into packages/design/engine/sealedResonance.ts:arrayVas by T902' <<< "$out"; } \
  && ok "a copy resolved under its previous key form is reported back even when its new key is allowed (exit 1)" || bad "resolved-under-old-form copy with its new key allowed should exit 1 naming arrayVas, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"; echo '{}' > "$SCRATCH/allow.json"; set_base

# T941 (John, QO963, 20 Nov 2026: "accept it, and let the check accept removed copies by itself from now on"): an allowed copy
# that has gone is resolved by itself. The removal passes with the allow-list untouched; the gone state is the base tree, so a
# copy that was gone on the base and returns fails (QO949); adding an entry still fails; a copy reworded but still duplicating
# the sum is a new finding and fails while its old entry is reported gone.
echo '{}' > "$SCRATCH/allow.json"; set_base
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
allowed_allow; cp "$SCRATCH/allow.json" "$SCRATCH/allow.before"
g add -A > /dev/null; g commit -q -m "copy and its entry" && g tag -f base > /dev/null     # base: the copy and its entry
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "T941: an allowed copy that is still there passes (exit 0)" || bad "T941: still-there copy should pass, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q 'gone with this change' <<< "$out" && grep -qF "$KEY" <<< "$out" && cmp -s "$SCRATCH/allow.json" "$SCRATCH/allow.before"; } \
  && ok "T941: removing an allowed copy passes (exit 0) with no edit to the allow-list, reported as gone with this change" || bad "T941: removal should pass and be reported gone, got exit $rc: $out"
set_base      # the removal is merged: the base tree no longer has the copy, the entry is still listed, unresolved
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q 'matched nothing on the base either' <<< "$out"; } \
  && ok "T941: an entry already gone on the base is reported stale and passes (exit 0)" || bad "T941: already-gone entry should pass with a note, got exit $rc: $out"
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'were gone on the base' <<< "$out" && grep -q 'packages/design/engine/newcopy.ts' <<< "$out"; } \
  && ok "T941: a copy that was gone on the base and comes back fails (exit 1), though its entry is still listed" || bad "T941: returning copy should exit 1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"
OTHER_KEY="sig|driver-count-scaling|packages/design/engine/other.ts|export const share = (Vb: number, n: number): number => Vb / n;"
node -e 'const [a, k] = process.argv.slice(1); console.log(JSON.stringify({...JSON.parse(require("fs").readFileSync(a, "utf8")), [k]: {reason: "baseline", where: "packages/design/engine/other.ts:1", count: 1}}, null, 1));' "$SCRATCH/allow.json" "$OTHER_KEY" > "$SCRATCH/allow.new" && mv "$SCRATCH/allow.new" "$SCRATCH/allow.json"
printf 'export const share = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/other.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF "  new entry: $OTHER_KEY" <<< "$out"; } \
  && ok "T941: adding a new allow-list entry is still refused (exit 1), whatever is gone" || bad "T941: a new entry should exit 1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/other.ts"; cp "$SCRATCH/allow.before" "$SCRATCH/allow.json"

# Edited but still duplicated: the base has the copy listed; the head rewords the line (a renamed function), so the sum is
# still written out beside the engine. The old entry is gone; the reworded line is a new finding and fails.
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"; set_base
printf 'export const eachShare = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'new duplicated logic' <<< "$out" && grep -q 'packages/design/engine/newcopy.ts:1' <<< "$out" && grep -q 'gone with this change' <<< "$out"; } \
  && ok "T941: a reworded copy that still duplicates the sum fails (exit 1) as a new finding, its old entry reported gone" || bad "T941: reworded copy should exit 1 as new, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"; echo '{}' > "$SCRATCH/allow.json"; set_base

# A reviewed migration keeps the identity of its destination, even after that copy has gone.
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD_FORM" > "$SCRATCH/allow.json"
node -e 'const [o, k] = process.argv.slice(1); console.log(JSON.stringify({pairs: {[o]: k}}));' "$OLD_FORM" "$KEY" > "$SCRATCH/rekey.json"
set_base || setup_failed "base after the copy was removed"
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD_FORM" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'were gone on the base' <<< "$out" && grep -q 'newcopy.ts:1' <<< "$out"; } \
  && ok "a reviewed re-key cannot restore a copy absent from the base" || bad "a reviewed re-key cannot restore a copy absent from the base (exit $rc): $out"
echo '{"pairs": {}}' > "$SCRATCH/rekey.json"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

# A formula in its home on the base does not become an allowed base copy when the head drops that home.
allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
cp "$SCRATCH/homes.json" "$SCRATCH/homes.before"
echo '{"driver-count-scaling": ["packages/design/engine/newcopy.ts:perDriver"]}' > "$SCRATCH/homes.json"
set_base || setup_failed "base with the formula in its home"
cp "$SCRATCH/homes.before" "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'newcopy.ts:1' <<< "$out" && grep -q 'were gone on the base' <<< "$out"; } \
  && ok "base counts use the homes declared on the base" || bad "base counts use the homes declared on the base (exit $rc): $out"
rm "$SCRATCH/homes.before"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

# Comment-only edits leave existing formula findings active.
allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
UNIT_LINE='export const litres = (volume: number): number => volume / 1000;'
UNIT_KEY="sig|unit-factor|packages/design/engine/units.ts|$UNIT_LINE"
node -e 'const [a, k] = process.argv.slice(1); console.log(JSON.stringify({...JSON.parse(require("fs").readFileSync(a, "utf8")), [k]: {reason: "baseline", where: "x:1", count: 1}}));' "$SCRATCH/allow.json" "$UNIT_KEY" > "$SCRATCH/allow.new" && mv "$SCRATCH/allow.new" "$SCRATCH/allow.json"
printf '%s\n' "$UNIT_LINE" > "$SCRATCH/packages/design/engine/units.ts"
set_base || setup_failed "base with allowed driver-count and unit formulas"
printf '/* driver share */%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } \
  && ok "a leading block comment keeps an allowed formula active" || bad "a leading block comment keeps an allowed formula active (exit $rc): $out"
printf '%s /* driver share\ncontinues here *// n;\n' "${COPY_LINE% / n;}" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } \
  && ok "a multiline block comment keeps an allowed formula active" || bad "a multiline block comment keeps an allowed formula active (exit $rc): $out"
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
printf '%s // delay is documented elsewhere\n' "$UNIT_LINE" > "$SCRATCH/packages/design/engine/units.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } \
  && ok "a comment carrying an exclusion keeps an allowed formula active" || bad "a comment carrying an exclusion keeps an allowed formula active (exit $rc): $out"
rm "$SCRATCH/packages/design/engine/units.ts" "$SCRATCH/packages/design/engine/newcopy.ts"

# Comment line breaks can separate class fields or appear inside a formula or an existing line.
UNIT_FILE="$SCRATCH/packages/design/engine/units.ts"
FIELD_LINE='litres = this.volume / 1000;'
SAME_LINE='const volume = 1; const litres = volume / 1000;'
node -e 'const [file, ...lines] = process.argv.slice(1); console.log(JSON.stringify(Object.fromEntries(lines.map(line => [
  `sig|unit-factor|${file}|${line}`, {reason: "baseline", where: "x:1", count: 1}
]))));' packages/design/engine/units.ts "$FIELD_LINE" "$UNIT_LINE" "$SAME_LINE" > "$SCRATCH/allow.json"
printf 'class Volume {
  volume = 1;
  delay = 0;
  %s
}
%s
%s
' "$FIELD_LINE" "$UNIT_LINE" "$SAME_LINE" > "$UNIT_FILE"
set_base || setup_failed "base with allowed unit conversions in three layouts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '4 formula signatures.*3 allowed.*0 gone' <<< "$out"; } || setup_failed "unit conversions are active on fixture base (exit $rc): $out"

check_unit_comment() {
  printf '%s
' "$2" > "$UNIT_FILE"
  out="$(run)"; rc=$?
  { [ "$rc" = 0 ] && grep -q '4 formula signatures.*3 allowed.*0 gone' <<< "$out"; } \
    && ok "$1" || bad "$1 (exit $rc): $out"
}
UNIT_FIXTURE="$(cat "$UNIT_FILE")"
check_unit_comment "a block comment between class fields keeps the conversion active" \
  "${UNIT_FIXTURE/  delay = 0;$'
'/  delay = 0;\/\*$'
'\*\/}"
check_unit_comment "a line comment after division keeps the conversion active" \
  "${UNIT_FIXTURE/"$UNIT_LINE"/"${UNIT_LINE%1000;}// conversion"$'
  1000;'}"
check_unit_comment "a multiline comment between same-line statements keeps the original key" \
  "${UNIT_FIXTURE/"$SAME_LINE"/'const volume = 1; /* note'$'
continued */ const litres = volume / 1000;'}"

echo '{}' > "$SCRATCH/allow.json"
rm "$UNIT_FILE"
set_base || setup_failed "base without the unit conversions"
printf 'class Volume {
  volume = 1;
  delay = 0;/*
  */ litres = this.volume / 1000;
}
' > "$UNIT_FILE"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'new duplicated logic' <<< "$out" && grep -q 'unit-factor .*units.ts:4' <<< "$out"; } \
  && ok "a new conversion after a block comment between fields is refused" || bad "new class conversion should be refused (exit $rc): $out"
printf '%s// conversion
  1000;
' "${UNIT_LINE%1000;}" > "$UNIT_FILE"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'new duplicated logic' <<< "$out" && grep -q 'unit-factor .*units.ts:1' <<< "$out"; } \
  && ok "a new conversion split by a line comment is refused" || bad "new split conversion should be refused (exit $rc): $out"
rm "$UNIT_FILE"

# Comments within a formula must leave its key identical to the comment-free form.
DB_FILE="$SCRATCH/packages/design/engine/decibels.ts"
DB_LINE='export const db = (ratio: number): number => 20 * Math.log10(ratio);'
printf '%s\n' "$DB_LINE" > "$DB_FILE"
db_keys="$(sig_keys)"
grep -qxF "sig|decibel|packages/design/engine/decibels.ts|$DB_LINE" <<< "$db_keys" || setup_failed "comment-free decibel signature"
check_db_comment() {
  printf '%s\n' "$2" > "$DB_FILE"
  keys="$(sig_keys)"
  [ "$keys" = "$db_keys" ] && ok "$1" || bad "$1: $keys"
}
check_db_comment "a line comment before multiplication keeps the decibel signature" \
  "${DB_LINE/20 /20 // scale$'\n  '}"
check_db_comment "a line comment after Math. keeps the decibel signature" \
  "${DB_LINE/Math./Math. // scale$'\n  '}"
check_db_comment "a line comment before the property-access dot keeps the decibel signature" \
  "${DB_LINE/Math./Math // scale$'\n  .'}"
check_db_comment "a block comment inside the argument list keeps the decibel signature" \
  "${DB_LINE/log10(ratio)/log10(\/* ratio$'\n  '*\/ratio)}"
rm "$DB_FILE"

VUE_FILE="$SCRATCH/packages/design/engine/Decibels.vue"
printf '<script setup lang="ts">\n%s\n</script>\n' "$DB_LINE" > "$VUE_FILE"
vue_keys="$(sig_keys)"
grep -qxF "sig|decibel|packages/design/engine/Decibels.vue|$DB_LINE" <<< "$vue_keys" || setup_failed "decibel signature in a Vue script"
printf '<!-- <script> /* -->\n<script setup lang="ts">\n%s\n</script>\n' "$DB_LINE" > "$VUE_FILE"
keys="$(sig_keys)"
[ "$keys" = "$vue_keys" ] && ok "an HTML comment containing a fake script tag leaves the Vue formula visible" \
  || bad "an HTML comment containing a fake script tag leaves the Vue formula visible: $keys"
rm "$VUE_FILE"

# The export policy for a tracked file does not change what is present on the base.
allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
echo 'packages/design/engine/newcopy.ts export-ignore' > "$SCRATCH/.gitattributes"
set_base || setup_failed "base with an export-ignored formula"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } \
  && ok "base counts include tracked files marked export-ignore" || bad "base counts include tracked files marked export-ignore (exit $rc): $out"
rm "$SCRATCH/.gitattributes" "$SCRATCH/packages/design/engine/newcopy.ts"
echo '{}' > "$SCRATCH/allow.json"; set_base || setup_failed "clean base after review regressions"

# T934 review 7: jscpd reads no configuration from the checkout. A .jscpd.json, a "jscpd" section in package.json and a
# .gitignore that would raise the minimum or leave packages/ out do not hide a copy: every option is the scanner's own.
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
before="$(copy_keys)"
echo '{"minLines": 1000, "minTokens": 100000, "ignore": ["**/engine/**"]}' > "$SCRATCH/.jscpd.json"
echo '{"name": "x", "jscpd": {"minLines": 1000, "minTokens": 100000, "ignore": ["**/engine/**"]}}' > "$SCRATCH/package.json"
printf 'packages/\n' > "$SCRATCH/.gitignore"
after="$(copy_keys)"
{ [ -n "$before" ] && [ "$before" = "$after" ]; } && ok "a checkout's .jscpd.json, package.json jscpd section and .gitignore do not hide a copy" || bad "planted jscpd config should not change the copies: before [$before] after [$after]"
rm -f "$SCRATCH/.jscpd.json" "$SCRATCH/package.json" "$SCRATCH/.gitignore" "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"

# A block comment spanning the end of an import and the next line cannot hide the next statement.
allowed_allow
IMPORT_LINE="import { area } from './clean';"
printf '%s\n%s\n' "$IMPORT_LINE" "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
set_base || setup_failed "base with an allowed formula after an import"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } || setup_failed "fixture formula after import is active (exit $rc): $out"
printf '%s /* comment\ncontinues here */%s\n' "$IMPORT_LINE" "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '0 gone' <<< "$out"; } \
  && ok "a block comment after an import keeps the next formula active" || bad "a block comment after an import keeps the next formula active (exit $rc): $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"
echo '{}' > "$SCRATCH/allow.json"; set_base || setup_failed "clean base for copy fixtures"

# Use a clone with no formula signatures so only jscpd can detect it.
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"
block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
CLONE_KEY="$(copy_keys)"
[ -n "$CLONE_KEY" ] || setup_failed "jscpd clone fixture"
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "a.ts:1 = b.ts:1", count: 1}}));' "$CLONE_KEY" > "$SCRATCH/allow.json"
set_base || setup_failed "base with an allowed clone"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '1 copies' <<< "$out" && grep -q '0 gone' <<< "$out"; } || setup_failed "fixture clone is active (exit $rc): $out"

{ echo '// jscpd:ignore-start'; block 'one comment'; echo '// jscpd:ignore-end'; } > "$SCRATCH/packages/design/engine/b.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF 'packages/design/engine/b.ts:1: jscpd:ignore-start' <<< "$out" && ! grep -q 'gone with this change' <<< "$out"; } \
  && ok "jscpd ignore directives fail the scan and name the source file" || bad "jscpd ignore directives fail the scan and name the source file (exit $rc): $out"
set_base || setup_failed "base with jscpd ignore directives"
block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
out="$(run)"; rc=$?
{ [ "$rc" != 0 ] && grep -qF 'packages/design/engine/b.ts:1: jscpd:ignore-start' <<< "$out" && ! grep -q 'were gone on the base' <<< "$out"; } \
  && ok "jscpd ignore directives on the base fail the scan" || bad "jscpd ignore directives on the base fail the scan (exit $rc): $out"
set_base || setup_failed "restore base with an allowed clone"

for growth in lines bytes; do
  block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
  if [ "$growth" = lines ]; then
    printf '\n%.0s' {1..1000} >> "$SCRATCH/packages/design/engine/b.ts"
  else
    printf '//%102400s\n' '' >> "$SCRATCH/packages/design/engine/b.ts"
  fi
  out="$(run)"; rc=$?
  { [ "$rc" = 0 ] && grep -q '1 copies' <<< "$out" && grep -q '0 gone' <<< "$out"; } \
    && ok "growing a clone's file past jscpd's default $growth limit keeps it active" || bad "growing a clone's file past jscpd's default $growth limit keeps it active (exit $rc): $out"
done

# The wider scan includes large files on both revisions, so it can reject new clones without requiring entries for older ones.
mv "$SCRATCH/packages/design/engine/b.ts" "$SCRATCH/large.ts"
echo '{}' > "$SCRATCH/allow.json"; set_base || setup_failed "base without the large clone file"
cp "$SCRATCH/large.ts" "$SCRATCH/packages/design/engine/b.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'new duplicated logic' <<< "$out" && grep -q 'packages/design/engine/b.ts:' <<< "$out"; } \
  && ok "a new clone in a large file is refused and named" || bad "a new clone in a large file is refused and named (exit $rc): $out"
rm "$SCRATCH/large.ts"
set_base || setup_failed "base with an unlisted clone in a large file"
out="$(run)"; rc=$?
{ [ "$rc" = 0 ] && grep -q '1 copies' <<< "$out"; } \
  && ok "a clone in a large file already on the base is counted" || bad "a clone in a large file already on the base is counted (exit $rc): $out"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"

# A reviewed re-key whose copy was absent on the base cannot use a malformed count to evade the zero cap.
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 0}}));' "$OLD_FORM" > "$SCRATCH/allow.json"
node -e 'const [o, k] = process.argv.slice(1); console.log(JSON.stringify({pairs: {[o]: k}}));' "$OLD_FORM" "$KEY" > "$SCRATCH/rekey.json"
set_base || setup_failed "base with a zero-count entry and a reviewed re-key"
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
for count in '"invalid"' '"0"' -1 0.5 null missing; do
  node -e 'const [k, o, raw] = process.argv.slice(1); const count = raw === "missing" ? undefined : JSON.parse(raw);
    console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", was: o, count}}));' "$KEY" "$OLD_FORM" "$count" > "$SCRATCH/allow.json"
  out="$(run)"; rc=$?
  { [ "$rc" = 1 ] && grep -qF "count must be a non-negative integer: $KEY" <<< "$out"; } \
    && ok "a reviewed re-key rejects malformed count $count" || bad "a reviewed re-key rejects malformed count $count (exit $rc): $out"
done

# Validate even resolved base entries whose counts would otherwise never be compared.
resolved_allow
sed -i 's/"count": 1/"count": "invalid"/' "$SCRATCH/allow.json"
set_base || setup_failed "base with a malformed resolved count"
resolved_allow
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -qF "allow.json at the base base: count must be a non-negative integer: $KEY" <<< "$out"; } \
  && ok "a malformed count on a resolved base entry is rejected" || bad "a malformed count on a resolved base entry is rejected (exit $rc): $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"
echo '{}' > "$SCRATCH/allow.json"; echo '{"pairs": {}}' > "$SCRATCH/rekey.json"
set_base || setup_failed "clean base after second review regressions"

# T934 review 3: a hand-reviewed pair says why; one without a reason stops the run (exit 2).
echo '{"pairs": {}, "hand_pairs": {"copy|a|b|1": {"to": "copy|a|b|2", "why": ""}}}' > "$SCRATCH/rekey.json"
out="$(run)"; rc=$?
{ [ "$rc" = 2 ] && grep -q 'hand_pairs' <<< "$out"; } && ok "a hand-reviewed re-key pair with no reason is refused (exit 2)" || bad "hand pair without why should exit 2, got exit $rc: $out"
echo '{"pairs": {}}' > "$SCRATCH/rekey.json"

# T934 review 3: every pair in the shipped mapping was made from the base source, so a gate run without --rekey refuses (exit 2).
out="$(node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --base base 2>&1)"; rc=$?
[ "$rc" = 2 ] && ok "a gate run without --rekey is refused (exit 2)" || bad "no --rekey should exit 2, got exit $rc: $out"

out="$(node "$REPO/scripts/dupscan.mjs" "$REPO" --jscpd "$JSCPD" --allow "$REPO/scripts/dupscan-allow.json" --homes "$REPO/scripts/dupscan-homes.json" --rekey "$REPO/scripts/dupscan-rekey-T934.json" --base origin/main 2>&1)"; rc=$?
[ "$rc" = 0 ] && ok "this repo passes with the shipped allow-list and homes, against origin/main" || bad "repo should pass with its allow-list, got exit $rc: $out"

[ "$fails" = 0 ] || { echo "dupscan.test: $fails failed"; exit 1; }
echo "dupscan.test: all passed"
