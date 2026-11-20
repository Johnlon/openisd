#!/usr/bin/env node
// dupscan: find duplicated logic in OpenISD and refuse NEW copies (a ratchet).
//
// Two deterministic checks, no AI:
//   1. Copy detector (jscpd) over packages/ (.ts, .vue; tests, generated files and node_modules left out).
//   2. Formula signatures: regexes for the physics and conversions the engine owns (driver-count
//      scaling, sealed resonance, resonance/compliance, dB, air, unit factors, rounding), plus "any
//      maths in packages/ui". Each hit is keyed by rule + file + the line's own text (no line number,
//      so moving code does not trip the gate; editing the line does).
//
// Findings must be listed in the allow-list (dupscan-allow.json) with a reason, or the run fails (exit 1).
// The scan also covers files outside jscpd's previous size limits. Copies already present outside those limits on the
// base are reported and capped at their base count. The first run writes the current state as the baseline:
//   node dupscan.mjs <repo> --homes <homes.json> --write-baseline           # record today's findings, reason "baseline"
//   node dupscan.mjs <repo> --homes <homes.json> --rekey <rekey.json> --base origin/main   # gate: exit 1 on any finding not in the allow-list
//   node dupscan.mjs <repo> --homes <homes.json> --rekey <rekey.json> --base origin/main --report out.json   # also write every finding to a file
//   node dupscan.mjs <base checkout> --allow <its allow-list> --homes <homes.json> --write-rekey out.json   # the re-key mapping
// Options: --allow <file> (default: dupscan-allow.json next to this script), --jscpd <path to jscpd bin>.
// CI (.github/workflows/pr.yml): --allow scripts/dupscan-allow.json --homes scripts/dupscan-homes.json
//   --rekey scripts/dupscan-rekey-T934.json --base origin/main.
//
// A copy that has been consolidated into the engine is never deleted from the allow-list: its entry stays, marked
//   "resolved": true, "resolved_to": "<engine file>:<function>", "resolved_by": "<task id>", "ruling": "<questions.yml id>"
// (John, QO949, 18 Nov 2026: "old entries stay, marked 'resolved, resolved to <engine function> by T902'; a resolved copy
// that reappears fails"). A resolved entry never allows its key: the copy reappearing fails, naming the function to call.
// An allowed (unresolved) entry whose key no longer matches anything is reported as gone and passes (T941, below); marking it
// resolved is still welcome but never required.
//
// A copy that has gone (T941; John, QO963, 20 Nov 2026: "accept it, and let the check accept removed copies by itself from now
// on", after "isn't the whole point of consolidation to remove duplicate code - why do you need to ask me to approve
// consolidation"): an allowed entry whose copy no longer matches never fails the run and never needs an edit to the allow-list
// (a gate file). Each run finds the same keys on the BASE tree (tracked sources and homes at --base, scanned by this script) and
// an unresolved entry listed on the base allows at most as many matches as the base tree had: an entry the head no longer
// matches but the base did is reported "gone with this change"; one the base did not match either is reported "already gone"; a
// copy that was gone on the base and is found again fails, naming the key (QO949: a gone copy that returns fails). So the "gone"
// state is the base tree itself, nothing a person records. Adding an entry or un-resolving one stays refused by the ratchet
// below (a gate-file edit that needs gates_approved). A copy reworded so it still duplicates logic is a different key: it is a
// new finding and fails as before, while its old entry is reported gone.
//
// T934 (John, 19 Nov 2026: "why wasn't the consolidation finished - our guard rail isn't working / remove the dupe and fix
// the guardrail"):
//   - Homes (--homes, scripts/dupscan-homes.json): each kind of sum names its home, one engine function, const or class
//     member (file:name; never a whole file), matched by its exact name with the TypeScript parser. A line whose every match
//     lies inside that declaration's own text is the engine doing its job, not a copy; anywhere else (code after the closing
//     brace on the same line included) it is a finding, and the refusal names the home to call. A declared home that is a
//     whole file, does not exist, is declared more than once, or lies outside packages/design/engine/ fails the run. A kind
//     with no home behaves as before. The homes file and this script are gate files (land.conf GATE_FILES).
//   - Ratchet (--base <git ref>): the allow-list is compared with the one on the base commit and may only shrink. Refused:
//     a new unresolved entry, a raised count, a deleted entry, a resolved entry made unresolved, replaced or rewritten
//     (resolved_to, resolved_by and ruling are history). One exception, help text (QO950): a new signature entry whose
//     reason starts "help text, no code" is accepted only when every match on its line lies inside a string or a comment
//     (prose), never when any of it is code; a copy (jscpd) is never help text. An entry re-keyed (the key's form changed)
//     names its old key in "was": the old key must be an unresolved entry on the base, gone from this list, of the same
//     rule and file (a copy: the same two files), claimed by this entry alone, with no higher count, and the pair (old key,
//     new key) must be in the reviewed re-key mapping (--rekey, scripts/dupscan-rekey-T934.json, a gate file; T934 review 3).
//     The mapping is made once from the BASE source (--write-rekey, run on the base checkout): each entry's old key to the
//     same finding's new key on that unchanged code, so a line or copy changed since the base (a string's spaces, a copy
//     grown over more shared code) is a different finding and never takes an allowance. A "was" with no pair is refused.
//     A resolved entry is found under either form (legacySignatureKey, legacyCopyKeys: used to refuse, never to allow), and
//     before the allowances, so a copy recorded resolved under one form that comes back is reported as consolidated.
//   - Keys leave comments out and keep literals exactly: the TypeScript parser marks every character of a file as code,
//     string (string and template text), regular expression, comment or space (a .vue file: its <script> blocks; the rest
//     is markup, where <!-- --> is a comment). A key keeps code, strings and regular expressions as written; each run of
//     spaces and comments between them becomes one space, or one line break if the run held one (a copy's key; a formula
//     line has none); a comment with no space around it counts as nothing, or as one space between two word characters.
//     So rewording or adding a comment keeps a key; a "//" inside a string, template or regular expression is not a comment.
//   - jscpd runs comment-insensitive (--mode weak), so a comment changed in one copy does not hide or split the copy.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeTypes, parse as parseVue} from '@vue/compiler-dom';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repo = args.find(a => !a.startsWith('--') && !isOptionValue(a));
function isOptionValue(a) { const i = args.indexOf(a); return i > 0 && ['--allow', '--jscpd', '--report', '--homes', '--base', '--rekey', '--write-rekey', '--list-findings'].includes(args[i - 1]); }
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const USAGE = 'usage: node dupscan.mjs <openisd checkout> --homes <homes.json> (--base <git ref> --rekey <rekey.json> | --write-baseline | --write-rekey <out.json>) [--allow file] [--report file] [--jscpd bin]';
if (!repo) { console.error(USAGE); process.exit(2); }
const allowPath = opt('--allow') ?? join(here, 'dupscan-allow.json');
// No default for the homes or the base: a run that forgot them would quietly check less.
const homesPath = opt('--homes');
const baseRef = opt('--base');
const jscpdBin = resolve(opt('--jscpd') ?? join(repo, 'node_modules/.bin/jscpd'));   // absolute: jscpd runs in a temporary folder
const writeBaseline = args.includes('--write-baseline');
const rekeyPath = opt('--rekey');
const writeRekeyPath = opt('--write-rekey');
const listFindingsPath = opt('--list-findings');   // internal: the run on the base tree (see "A copy that has gone" above)
if (homesPath === null || (!writeBaseline && writeRekeyPath === null && listFindingsPath === null && (baseRef === null || rekeyPath === null))) { console.error(USAGE); process.exit(2); }

const IGNORE_DIRS = ['node_modules', 'test', 'generated', 'dist', 'coverage', 'ui-proposals'];
const IGNORE_SUFFIXES = ['.test.ts', '.spec.ts', '.generated.ts', '.config.ts'];
const IGNORE = [...IGNORE_DIRS.map(name => `**/${name}/**`), ...IGNORE_SUFFIXES.map(suffix => `**/*${suffix}`)];
const COPY_FORMATS = {typescript: ['ts', 'mts', 'cts'], vue: ['vue']};
const COPY_SUFFIXES = Object.values(COPY_FORMATS).flat().map(ext => `.${ext}`);
const isCopySource = path => COPY_SUFFIXES.some(suffix => path.endsWith(suffix));
const PREVIOUS_MAX_LINES = 1000;
const PREVIOUS_MAX_BYTES = 100 * 1024;

// ---- 1. copy detector ------------------------------------------------------------------------------
// jscpd runs comment-insensitive (--mode weak, T934 review 2): a comment reworded in one of two copies neither hides the
// copy nor splits it. Each copy also carries `oldKey`, its key in the previous key form (legacyCopyKeys), so a "was" claim
// is checked against the same copy and a resolved copy that comes back is recognised under either form.
// jscpd reads no configuration from the checkout (T934 review 7): it runs in an empty temporary folder (it reads package.json's
// "jscpd" section and .gitignore from its working folder), with an empty --config file (else .jscpd.json there), --no-gitignore,
// and every option it uses set here. Its file names come back absolute
// (--absolute) and are made relative to the checkout again; the ignore globs are anchored at the checkout.
function jscpd(mode, expanded) {
  if (!existsSync(jscpdBin)) { console.error(`jscpd not found at ${jscpdBin} (it is a devDependency: npm ci)`); process.exit(2); }
  const root = realpathSync(repo);
  const cwd = mkdtempSync(join(tmpdir(), 'dupscan-cwd-'));
  try {
    const config = join(cwd, 'jscpd-config.json'), out = join(cwd, 'report');
    writeFileSync(config, '{}\n');
    const formatsExts = Object.entries(COPY_FORMATS).map(([format, extensions]) => `${format}:${extensions.join(',')}`).join(';');
    execFileSync(jscpdBin, [join(root, 'packages'), '--config', config, '--no-gitignore',
      '--format', Object.keys(COPY_FORMATS).join(','), '--formats-exts', formatsExts, '--min-tokens', '50', '--min-lines', '5',
      '--max-lines', String(expanded ? Number.MAX_SAFE_INTEGER : PREVIOUS_MAX_LINES),
      '--max-size', String(expanded ? Number.MAX_SAFE_INTEGER : PREVIOUS_MAX_BYTES), '--mode', mode,
      '--ignore', IGNORE.map(g => `${root}/${g}`).join(','), '--absolute', '--reporters', 'json', '--output', out, '--silent'],
    {cwd, stdio: ['ignore', 'ignore', 'inherit']});
    // jscpd can exit 0 without writing a report when there are no clones; a crash exits non-zero above.
    const report = join(out, 'jscpd-report.json');
    if (!existsSync(report)) return [];
    const dups = JSON.parse(readFileSync(report, 'utf8')).duplicates;
    for (const d of dups) for (const f of [d.firstFile, d.secondFile]) f.name = relative(root, f.name);
    return dups;
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
}

/** A jscpd duplicate's two sides, in key order (by file name, then start line). */
const sidesOf = d => [d.firstFile, d.secondFile].sort((x, y) => x.name < y.name ? -1 : x.name > y.name ? 1 : x.start - y.start);

function copyFindings(withLegacy, expanded, oversized) {
  const legacy = withLegacy ? legacyCopyKeys(expanded) : [];
  const detected = jscpd('weak', expanded);
  const copies = expanded ? detected.filter(d => oversized.has(d.firstFile.name) || oversized.has(d.secondFile.name)) : detected;
  return copies.map(d => {
    const a = d.firstFile.name, b = d.secondFile.name;
    const norm = fragmentKeyText(a, d.fragment, d.firstFile.start);
    const hash = createHash('sha1').update(norm).digest('hex').slice(0, 12);
    const [f1, f2] = [a, b].sort();
    // The previous form's copy is the same copy when it lies within this one on both sides; exactly one, or none at all.
    const [s1, s2] = sidesOf(d);
    const within = legacy.filter(l => l.sides[0].name === s1.name && l.sides[1].name === s2.name
      && l.sides[0].start >= s1.start && l.sides[0].end <= s1.end && l.sides[1].start >= s2.start && l.sides[1].end <= s2.end);
    return {kind: 'copy', key: `copy|${f1}|${f2}|${hash}`, oldKey: within.length === 1 ? within[0].key : null, expanded,
      where: `${a}:${d.firstFile.start}-${d.firstFile.end} = ${b}:${d.secondFile.start}-${d.secondFile.end}`, lines: d.lines};
  });
}

/** The copies as the previous key form found and keyed them (before T934): jscpd in its default mode (comments count as
 *  code), the key hashing the fragment with whitespace folded. Used only to prove a re-key and to recognise a resolved
 *  copy recorded under that form; never to allow anything. */
function legacyCopyKeys(expanded) {
  return jscpd('mild', expanded).map(d => {
    const [f1, f2] = [d.firstFile.name, d.secondFile.name].sort();
    const hash = createHash('sha1').update((d.fragment ?? '').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
    return {key: `copy|${f1}|${f2}|${hash}`, sides: sidesOf(d)};
  });
}

/** A formula line's key in the previous key form (before T934): the trimmed line, comments included, whitespace folded. */
function legacySignatureKey(rule, rel, line) {
  return `sig|${rule}|${rel}|${line.trim().replace(/\s+/g, ' ')}`;
}

/** The key text of a jscpd fragment: the fragment is found in its file (the occurrence nearest the line jscpd names),
 *  and that stretch of the file's own classified characters is keyed, so a fragment that starts inside a string or a
 *  template is still read as the file reads. */
function fragmentKeyText(rel, fragment, startLine) {
  const src = source(rel);
  const at = [];
  for (let i = src.text.indexOf(fragment); i >= 0; i = src.text.indexOf(fragment, i + 1)) at.push(i);
  if (at.length === 0) { console.error(`dupscan: jscpd's fragment is not in ${rel} (line ${startLine})`); process.exit(2); }
  const lineOf = i => src.text.slice(0, i).split('\n').length;
  const off = at.reduce((best, i) => Math.abs(lineOf(i) - startLine) < Math.abs(lineOf(best) - startLine) ? i : best, at[0]);
  return keyText(src, off, off + fragment.length, false);
}

// ---- source classes ----------------------------------------------------------------------------------
// Every character of a file is 'code', 'string' (string and template text, quotes and ${ } delimiters included), 'regex',
// 'comment', 'space' (whitespace between tokens), 'joined' (whitespace introduced by a line comment)
// or 'markup' (a .vue file outside its <script> blocks).
const LITERAL = {[ts.SyntaxKind.StringLiteral]: 'string', [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: 'string',
  [ts.SyntaxKind.TemplateHead]: 'string', [ts.SyntaxKind.TemplateMiddle]: 'string', [ts.SyntaxKind.TemplateTail]: 'string',
  [ts.SyntaxKind.RegularExpressionLiteral]: 'regex'};
const sources = new Map();
/** The file `rel` (relative to the repo): its text, the class of each character and, for a .ts file, its parsed tree. */
function source(rel) {
  if (sources.has(rel)) return sources.get(rel);
  const text = readFileSync(join(repo, rel), 'utf8');
  const cls = new Array(text.length);
  const siblingBreaks = new Set();
  let tree = null;
  if (rel.endsWith('.vue')) {
    cls.fill('markup');
    const vue = parseVue(text, {parseMode: 'sfc', onError: () => {}});
    const markComments = node => {
      if (node.type === NodeTypes.COMMENT) cls.fill('comment', node.loc.start.offset, node.loc.end.offset);
      if (Array.isArray(node.children)) node.children.forEach(markComments);
    };
    markComments(vue);
    for (const block of vue.children) {
      if (block.type !== NodeTypes.ELEMENT || block.tag !== 'script' || !block.innerLoc) continue;
      const {start, source} = block.innerLoc;
      classifyTs(text, start.offset, source.length, cls, siblingBreaks);
    }
  } else tree = classifyTs(text, 0, text.length, cls, siblingBreaks);
  const src = {text, cls, tree, siblingBreaks};
  sources.set(rel, src);
  return src;
}

/** The parser locates tokens so the scanner only reads trivia, even beside a regexp or inside a template substitution. */
function classifyTs(text, from, length, cls, siblingBreaks) {
  const sf = ts.createSourceFile('x.ts', text.slice(from, from + length), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, sf.text);
  const tokens = [];
  const boundaries = new Set();
  const visit = node => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const start = node.getStart(sf);
    if (ts.isStatement(node) || ts.isClassElement(node)) {
      boundaries.add(start);
      boundaries.add(node.end);
    }
    const siblings = node.statements ?? node.members;
    if (siblings) {
      for (let i = 1; i < siblings.length; i++) {
        const newline = text.indexOf('\n', from + siblings[i - 1].end);
        if (newline !== -1 && newline < from + siblings[i].getStart(sf)) siblingBreaks.add(newline);
      }
    }
    const kids = node.getChildren(sf);
    if (kids.length > 0) kids.forEach(visit);
    else {
      cls.fill(LITERAL[node.kind] ?? 'code', from + start, from + node.end);
      if (start < node.end) tokens.push({start, end: node.end, kind: node.kind});
    }
  };
  visit(sf);

  let left = null;
  for (const right of [...tokens, {start: length}]) {
    const gapStart = left === null ? 0 : left.end;
    scanner.setTextPos(gapStart);
    let afterLineComment = false;
    // Keep statement boundaries (including ASI) and all ordinary line breaks. Inside a statement,
    // omit the newline and indentation needed to continue after a line comment.
    const join = left !== null && right.start < length && !boundaries.has(gapStart) && !boundaries.has(right.start);
    while (scanner.getTextPos() < right.start) {
      const kind = scanner.scan();
      const whitespace = kind === ts.SyntaxKind.WhitespaceTrivia || kind === ts.SyntaxKind.NewLineTrivia;
      const classification = whitespace ? (afterLineComment ? 'joined' : 'space') : 'comment';
      cls.fill(classification, from + scanner.getTokenPos(), from + Math.min(scanner.getTextPos(), right.start));
      if (join && kind === ts.SyntaxKind.SingleLineCommentTrivia) {
        afterLineComment = true;
        // A space used to separate the comment from a property-access dot is also comment layout.
        const tight = left.kind === ts.SyntaxKind.DotToken || right.kind === ts.SyntaxKind.DotToken;
        const before = sf.text.slice(gapStart, scanner.getTokenPos());
        if (tight && /^[^\S\r\n\u2028\u2029]*$/.test(before)) cls.fill('joined', from + gapStart, from + scanner.getTokenPos());
      }
    }
    left = right;
  }
  return sf;
}

/** The key text of src.text[from, to): code, strings and regular expressions as written, comments left out; each run of
 *  whitespace between them one space, or one line break when the run holds one; nothing before the first or after the last.
 *  A comment counts as nothing (T934 review 3: f(/* note *\/x) keys as f(x)), except between two word characters, where it
 *  separates two tokens as a space would (a/* c *\/b keys as a b, never ab). */
function keyText(src, from, to, signature) {
  let out = '', gap = null, commented = false;
  for (let i = from; i < to; i++) {
    const ch = src.text[i], k = src.cls[i];
    if (k === 'comment') { commented = true; continue; }
    if (signature && k === 'joined') continue;
    if (k === 'space' || k === 'joined' || (k === 'markup' && /\s/.test(ch))) {
      if (ch === '\n') gap = '\n';
      else if (gap === null) gap = ' ';
      continue;
    }
    if (gap === null && commented && /\w$/.test(out) && /\w/.test(ch)) gap = ' ';
    if (gap !== null && out !== '') out += gap;
    gap = null; commented = false;
    out += ch;
  }
  return out;
}

/** Whether every non-space character of src.text[from, to) lies in a string or a comment: prose, not code. */
function isProse(src, from, to) {
  for (let i = from; i < to; i++) if (!/\s/.test(src.text[i]) && src.cls[i] !== 'string' && src.cls[i] !== 'comment') return false;
  return true;
}

// ---- 2. formula signatures -------------------------------------------------------------------------
// Each rule: id, what it means in plain words, regex, and (optional) the directories it applies to.
const RULES = [
  {id: 'driver-count-scaling', what: 'N drivers scaled into one (n x Sd, Mms/n, Vb/n, x nDrivers)',
    re: /\b(nDrivers|numDrivers|driverCount)\b(\(\))?\s*\|*\s*\d*\)?\s*[*\/][^>]|[*\/]\s*\(?\s*(P\.|this\.#|p\.)?(nDrivers|numDrivers)\b|Sd_m2\s*\*\s*n\b|[^<]\/\s*n\s*[,;)+\-]|\bVb\s*\/\s*n\b/},
  {id: 'coil-wiring-scaling', what: 'voice-coil wiring scaling of Re/BL/Znom (numVC, series/parallel factor)',
    re: /\bnumVC\b\s*[*\/]|[*\/]\s*numVC\b|wiring(\.value)?\s*===\s*["'](series|parallel)["']\s*\?\s*[A-Za-z]+\s*:\s*1\s*\//},
  {id: 'sealed-box-ratio', what: 'sealed resonance factor sqrt(1 + Vas/Vb) or its inverse (Qtc/Qts)^2 - 1',
    re: /sqrt\(\s*1\s*\+\s*[A-Za-z_.]*[Vv]as|\(\s*[A-Za-z_.]*Q[a-z]*c\s*\/\s*[A-Za-z_.]*Q[a-z]*s?\s*\)\s*\*\*\s*2\s*-\s*1/},
  {id: 'resonance-mass-compliance', what: 'resonance from mass and compliance 1/(2 pi sqrt(M C)) or its inverse',
    re: /1\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*\s*Math\.sqrt|1\s*\/\s*\(\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*\)\s*\*\*\s*2/},
  {id: 'q-parallel', what: 'Qts from Qes and Qms, or a source-loaded Qes',
    re: /Qes[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qms|Qms[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qes|1\s*\/\s*\(\s*1\s*\/\s*[A-Za-z_.]*Q[a-z]*s[A-Za-z_]*\s*\+\s*1\s*\/|\(\s*[A-Za-z_.]*(re|Re)[A-Za-z_]*\s*\+\s*[^)]*(rg|Rg|RG|rs|Rs)[A-Za-z_]*\)\s*\)?\s*\/\s*[A-Za-z_.]*(re|Re)\b/},
  {id: 'bl-from-qes', what: 'BL from Re, Fs, Qes and Cms',
    re: /Math\.sqrt\([^)]*Re[A-Za-z_]*\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*Qes/},
  {id: 'air-compliance', what: 'acoustic compliance V/(rho c^2) or Vas = rho c^2 Sd^2 Cms',
    re: /(rho|roo)[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c\b(\(\))?/},
  {id: 'circle-area', what: 'port or cone area from diameter, or diameter from area',
    re: /Math\.PI\s*\*\s*\(?\s*[A-Za-z_.!]+\s*\/\s*2\s*\)?\s*\*\*\s*2|2\s*\*\s*Math\.sqrt\(\s*[A-Za-z_.!]+\s*\/\s*Math\.PI\s*\)/},
  {id: 'displacement', what: 'displacement Vd = Sd x Xmax',
    re: /[Ss]d[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Xx]max|[Xx]max[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Ss]d\b/},
  {id: 'decibel', what: 'dB conversion 10 log10 / 20 log10 / 10^(x/20)',
    re: /(10|20)\s*\*\s*Math\.log10|Math\.pow\(\s*10\s*,[^)]*\/\s*(10|20)\s*\)|10\s*\*\*\s*\([^)]*\/\s*(10|20)\s*\)/},
  {id: 'drive-voltage-power', what: 'power and voltage through Re (V^2/R, sqrt(P R), the 2.83 V reference)',
    re: /\b2\.83\b|Math\.sqrt\(\s*[A-Za-z_.]*(pin|power|Pe|P)[A-Za-z_]*\s*\*\s*\(?\s*[A-Za-z_.]*(re|Re)/},
  {id: 'end-correction', what: 'port end correction constant or literal',
    re: /\b0\.732\b|\b0\.613\b|END_CORRECTION\b/},
  {id: 'air-defaults', what: 'reference air: 293.15 K, 101325 Pa, 30 %',
    re: /\b293\.15\b|\b101325\b/},
  {id: 'unit-factor', what: 'hand-written unit conversion (litres, cm, mm, inches, cm2, cm3)',
    re: /[*\/]\s*(1000|1e3|1e-3|1e6|1e-6|10_?000|0\.0254|2\.54|25\.4|100)\b(?!\s*\*\s*1000)/,
    skip: /setTimeout|ms\b|_ms|Ms\b|Date|delay|seconds|bytes|interval|elapsed|percent|Pct|pct|%|devicePixelRatio|scale\b/},
  {id: 'display-rounding', what: 'rounding a number for display outside the field formatter',
    re: /\.toFixed\(|\.toPrecision\(|Math\.round\([^)]*\*\s*(10|100|1000|scale)\b/},
  {id: 'ui-maths', what: 'arithmetic maths in packages/ui (the UI is display only)', dirs: ['packages/ui/src/'],
    re: /Math\.(sqrt|pow|log|log10|exp|PI|hypot)\b|\*\*\s*\d/},
];

// ---- homes: where each kind of sum lives -------------------------------------------------------------
// homes.json: {"<rule id>": ["<engine file>:<function, const or class member>", ...]}. A home is one declaration, never a
// whole file (T934 review: a whole file hides any second copy written in it).
const homeErrors = [];
const homeSpans = loadHomes();   // [{rule, file, from, to, home}]: from, to are character offsets of the declaration's text

function loadHomes() {
  const declared = JSON.parse(readFileSync(homesPath, 'utf8'));
  const spans = [];
  for (const [rule, homes] of Object.entries(declared)) {
    if (!RULES.some(r => r.id === rule)) { homeErrors.push(`${rule}: no such kind of sum`); continue; }
    for (const home of homes) {
      const colon = home.indexOf(':');
      if (colon < 0) { homeErrors.push(`${rule}: home ${home} names no function (a home is one engine declaration, file:name)`); continue; }
      const file = home.slice(0, colon), name = home.slice(colon + 1);
      if (!file.startsWith('packages/design/engine/') || !file.endsWith('.ts')) { homeErrors.push(`${rule}: home ${home} is not a .ts file in packages/design/engine/`); continue; }
      if (!existsSync(join(repo, file))) { homeErrors.push(`${rule}: home ${home}: no such file`); continue; }
      const found = declarations(source(file).tree).filter(d => d.name === name);
      if (found.length !== 1) { homeErrors.push(`${rule}: home ${home}: ${found.length === 0 ? 'not declared there' : `declared ${found.length} times there`}`); continue; }
      spans.push({rule, file, from: found[0].from, to: found[0].to, home});
    }
  }
  return spans;
}

/** The named declarations at the top of a parsed file, by their exact names: functions with a body, consts and lets, and the
 *  members of its classes. Each spans its own text, from its first token to its last. */
function declarations(sf) {
  const out = [];
  const add = (name, node) => out.push({name, from: node.getStart(sf), to: node.end});
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) add(st.name.text, st);
    else if (ts.isVariableStatement(st)) {
      const decls = st.declarationList.declarations;
      for (const d of decls) if (ts.isIdentifier(d.name)) add(d.name.text, decls.length === 1 ? st : d);
    } else if (ts.isClassDeclaration(st)) {
      for (const m of st.members) {
        if (!m.name || !(ts.isIdentifier(m.name) || ts.isPrivateIdentifier(m.name))) continue;
        if ((ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) && !m.body) continue;
        add(m.name.text, m);
      }
    }
  }
  return out;
}

/** The home of a line's sum: the declared home of `rule` in `rel` holding every one of `matches` ([from, to) offsets). */
function homeOf(rule, rel, matches) {
  return homeSpans.find(h => h.rule === rule && h.file === rel && matches.every(([a, b]) => a >= h.from && b <= h.to))?.home ?? null;
}

function walk(dir, files) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (IGNORE_DIRS.includes(name)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (isCopySource(name) && !IGNORE_SUFFIXES.some(suffix => name.endsWith(suffix))) files.push(p);
  }
  return files;
}

/** Check exactly the raw marker text jscpd accepts, even if it appears in a literal. */
function checkCopySources(files) {
  const oversized = new Set();
  for (const file of files) {
    const bytes = readFileSync(file);
    const text = bytes.toString('utf8');
    const rel = relative(repo, file);
    const marker = /jscpd:ignore-(?:start|end)/.exec(text);
    if (marker !== null) {
      const line = text.slice(0, marker.index).split('\n').length;
      console.error(`dupscan: ${rel}:${line}: ${marker[0]} is forbidden`);
      process.exit(1);
    }
    if (bytes.length > PREVIOUS_MAX_BYTES || text.split('\n').length > PREVIOUS_MAX_LINES) oversized.add(rel);
  }
  return oversized;
}

/** Comment-free text for signature matching, with each character mapped back to its source offset. */
function signatureLine(src, from, to) {
  const offsets = [];
  let text = '';
  let commented = false;
  for (let i = from; i < to; i++) {
    if (src.cls[i] === 'comment') { commented = true; continue; }
    if (src.cls[i] === 'joined') continue;
    const ch = src.text[i];
    if (commented && /\w$/.test(text) && /\w/.test(ch)) {
      text += ' ';
      offsets.push(i - 1);
    }
    commented = false;
    text += ch;
    offsets.push(i);
  }
  return {text, offsets};
}

function sameMatches(first, second) {
  return first.length === second.length && first.every(([from, to], i) => from === second[i][0] && to === second[i][1]);
}

function isRecordedResolution(finding, recorded) {
  return recorded[finding.key]?.resolved === true || recorded[finding.oldKey]?.resolved === true;
}

function signatures(files, recorded) {
  const hits = [];
  for (const file of files) {
    if (!/\.(ts|vue)$/.test(file) || file.endsWith('.d.ts')) continue;
    const rel = relative(repo, file);
    const src = source(rel);
    let lineStart = 0;
    let signatureStart = 0;
    let breaks = [];
    for (const [i, line] of src.text.split('\n').entries()) {
      const end = lineStart + line.length;
      lineStart = end + 1;
      if (src.cls[end] === 'comment') {
        if (src.siblingBreaks.has(end)) breaks.push(end);
        continue;
      }
      if (src.cls[end] === 'joined') continue;
      const at = signatureStart;
      signatureStart = lineStart;
      const spans = [...breaks, end].map((to, j) => {
        const from = j === 0 ? at : breaks[j - 1] + 1;
        return {from, to, ...signatureLine(src, from, to)};
      });
      const joined = breaks.length ? signatureLine(src, at, end) : null;
      breaks = [];
      for (const r of RULES) {
        if (r.dirs && !r.dirs.some(d => rel.startsWith(d))) continue;
        const find = (code, from, to) => {
          const t = code.text.trim();
          if (t.startsWith('*') || t.startsWith('import ') || !r.re.test(code.text) || (r.skip && r.skip.test(code.text))) return null;
          const matches = [...code.text.matchAll(new RegExp(r.re.source, 'g'))]
            .map(m => [code.offsets[m.index], code.offsets[m.index + m[0].length - 1] + 1]);
          const lineNumber = i + 1 - (src.text.slice(matches[0][0], end).match(/\n/g)?.length ?? 0);
          return {matches, finding: {kind: 'signature', rule: r.id, what: r.what, key: `sig|${r.id}|${rel}|${keyText(src, from, to, true)}`,
            oldKey: legacySignatureKey(r.id, rel, src.text.slice(from, to)), where: `${rel}:${lineNumber}`,
            layer: layerOf(rel), home: homeOf(r.id, rel, matches), prose: matches.every(([a, b]) => isProse(src, a, b))}};
        };
        const split = spans.map(span => find(span, span.from, span.to)).filter(Boolean);
        const whole = joined === null || split.length === 0 ? null : find(joined, at, end);
        // A newline inside a comment can replace a real line break or be inserted on a single line. Scan siblings
        // independently so their exclusions cannot leak. Keep a recorded whole-line key when it covers the same matches.
        if (whole !== null && (whole.finding.key in recorded || isRecordedResolution(whole.finding, recorded))
          && !split.some(({finding}) => isRecordedResolution(finding, recorded))
          && (isRecordedResolution(whole.finding, recorded) || !split.some(({finding}) => finding.key in recorded))
          && split.every(({finding}) => finding.home === whole.finding.home)
          && sameMatches(split.flatMap(hit => hit.matches), whole.matches)) {
          hits.push(whole.finding);
        } else {
          hits.push(...split.map(hit => hit.finding));
        }
      }
    }
  }
  return hits;
}

function layerOf(rel) {
  if (rel.startsWith('packages/design/engine/')) return 'engine';
  if (rel.startsWith('packages/design/domain/')) return 'domain';
  if (rel.startsWith('packages/ui/')) return 'ui';
  return rel.split('/').slice(0, 3).join('/');
}

// ---- gate ------------------------------------------------------------------------------------------
const files = walk(join(repo, 'packages'), []);
const oversized = checkCopySources(files);
const withLegacy = listFindingsPath === null;
// Retain the earlier scan for smaller files: adding files to a jscpd run can change which pairs it reports.
// The expanded scan supplies the pairs the earlier one could not see because of a file's size.
const copies = copyFindings(withLegacy, false, oversized);
if (oversized.size > 0) copies.push(...copyFindings(withLegacy, true, oversized));
const allowFile = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
validateAllowCounts(allowFile, allowPath);
const findings = [...copies, ...signatures(files, allowFile)];
const groups = {};
for (const f of findings.filter(f => f.kind === 'signature')) (groups[f.rule] ??= new Set()).add(f.layer);

if (opt('--report')) writeFileSync(opt('--report'), JSON.stringify({findings, layersPerRule: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...v]]))}, null, 2));

if (listFindingsPath !== null) {
  // The run on the base tree: how many times each key is found outside its home (the head's run counts the same way).
  const counts = {}, largeCopies = {};
  for (const f of findings.filter(f => !f.home)) {
    counts[f.key] = (counts[f.key] ?? 0) + 1;
    if (f.expanded) largeCopies[f.key] = (largeCopies[f.key] ?? 0) + 1;
  }
  writeFileSync(listFindingsPath, JSON.stringify({counts, largeCopies}));
  process.exit(0);
}

if (writeBaseline) {
  // Resolved entries are the record of consolidations (QO949): a new baseline keeps them.
  const entries = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved === true));
  for (const f of findings) {
    const e = entries[f.key] ??= {reason: 'baseline 2026-11-18 (QO946.c256)', where: f.where, count: 0};
    e.count += 1;
  }
  writeFileSync(allowPath, JSON.stringify(entries, null, 1) + '\n');
  console.log(`wrote ${Object.keys(entries).length} allow-list entries to ${allowPath}`);
  process.exit(0);
}

if (writeRekeyPath !== null) {
  // The re-key mapping (T934 review 3), made from THIS tree, so run it on the base checkout: each unresolved allow-list
  // entry's key, in the previous key form, to the same finding's key now. An old key two findings would take is left out.
  const pairs = {}, clash = new Set();
  for (const f of findings) {
    if (f.oldKey === null || f.oldKey === f.key || !(f.oldKey in allowFile) || allowFile[f.oldKey].resolved === true) continue;
    if (f.oldKey in pairs && pairs[f.oldKey] !== f.key) clash.add(f.oldKey); else pairs[f.oldKey] = f.key;
  }
  for (const k of clash) delete pairs[k];
  let commit;
  try { commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); }
  catch { commit = 'not a git checkout'; }
  writeFileSync(writeRekeyPath, JSON.stringify({base: commit, made_by: 'node scripts/dupscan.mjs <base checkout> --allow <its allow-list> --homes <homes> --write-rekey <this file>',
    pairs: Object.fromEntries(Object.entries(pairs).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))}, null, 1) + '\n');
  console.log(`wrote ${Object.keys(pairs).length} re-key pairs to ${writeRekeyPath}${clash.size ? `; left out ${clash.size} old keys two findings would take:\n  ${[...clash].join('\n  ')}` : ''}`);
  process.exit(0);
}

// The reviewed re-key mapping (--rekey): an entry's "was" is accepted only as one of its pairs (T934 review 3). "pairs" are
// made by --write-rekey from the base source; "hand_pairs" ({old: {to, why}}) are pairs a person reviewed where the base
// source cannot pair them (one comment-insensitive copy holding two previous-form copies), each saying why.
const rekeyFile = JSON.parse(readFileSync(rekeyPath, 'utf8'));
function isMap(o) {
  return typeof o === 'object' && o !== null && !Array.isArray(o);
}
if (!isMap(rekeyFile.pairs)) { console.error(`dupscan: ${rekeyPath} has no "pairs" object`); process.exit(2); }
const hand = rekeyFile.hand_pairs ?? {};
if (!isMap(hand) || !Object.values(hand).every(h => isMap(h) && typeof h.to === 'string' && typeof h.why === 'string' && h.why.trim() !== '')) {
  console.error(`dupscan: ${rekeyPath}: each of "hand_pairs" is {"to": <new key>, "why": <the reason, reviewed>}`); process.exit(2);
}
const rekey = {...rekeyFile.pairs, ...Object.fromEntries(Object.entries(hand).map(([o, h]) => [o, h.to]))};
const baseAllow = readBaseAllow();
if (baseAllow.list !== undefined) validateAllowCounts(baseAllow.list, `${allowPath} at the base ${baseRef}`);
const resolved = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved === true));
// A previous-form key the mapping moves to another key allows nothing: read as a key of the new form it would name a
// different line (a string's spaces folded) or copy (T934 review 3). Its entry must move to the mapped key.
const movedAway = k => k in rekey && rekey[k] !== k;
const allow = Object.fromEntries(Object.entries(allowFile).filter(([k, e]) => e.resolved !== true && !movedAway(k)));
const incomplete = Object.keys(resolved).filter(k => !['resolved_to', 'resolved_by', 'ruling'].every(f => typeof resolved[k][f] === 'string' && resolved[k][f] !== ''));
// A match inside its kind's home is not a copy (T934).
const inHome = findings.filter(f => f.home);
const active = findings.filter(f => !f.home);
const homeOfKey = Object.fromEntries(inHome.map(f => [f.key, f.home]));
const seen = new Set(active.map(f => f.key));
// A resolved entry keeps its key as recorded, in either key form: a copy coming back is found under both (T934 review 2).
// The previous form is used only to refuse, never to allow. Recurrence is checked before the allowances (T934 review 3): an
// allowed entry under one key form never hides a consolidated copy recorded under the other.
const resolvedEntryOf = f => resolved[f.key] ?? (f.oldKey !== null && f.oldKey in resolved ? resolved[f.oldKey] : undefined);
const back = active.filter(f => resolvedEntryOf(f) !== undefined);
// What the base tree matched (T941). Unreadable base allow-list: the ratchet fails the run, and no allowance is cut down.
const baseFindings = baseAllow.list === undefined ? null : scanBase();
if (baseAllow.list !== undefined && baseFindings === null) process.exit(1);
const onBase = baseFindings?.counts ?? null;
// Existing and migrated allowances are capped by the current key's count on the base tree.
const allowedCount = k => {
  const fromBase = onBase !== null && (k in baseAllow.list || typeof allow[k].was === 'string');
  return Math.min(allow[k].count, fromBase ? (onBase[k] ?? 0) : Infinity);
};
const counts = {};
const knownLargeCopies = [];
const unlisted = active.filter(f => resolvedEntryOf(f) === undefined)
  .filter(f => {
    const count = counts[f.key] = (counts[f.key] ?? 0) + 1;
    if (f.key in allow) return count > allowedCount(f.key);
    // A copy outside the previous size limits can pass only up to its count outside those limits on the base.
    if (f.expanded && count <= (baseFindings?.largeCopies[f.key] ?? 0)) {
      knownLargeCopies.push(f);
      return false;
    }
    return true;
  });
const returned = unlisted.filter(f => f.key in allow && onBase !== null && (onBase[f.key] ?? 0) === 0);
const newOnes = unlisted.filter(f => !returned.includes(f));
const gone = Object.keys(allow).filter(k => !seen.has(k));
const goneNow = gone.filter(k => onBase !== null && (onBase[k] ?? 0) > 0);
const goneAlready = gone.filter(k => !goneNow.includes(k));
const ratchet = ratchetAgainstBase();

/** Check all entries before count comparisons, including entries whose copies have gone or were marked resolved. */
function validateAllowCounts(list, label) {
  if (!isMap(list)) { console.error(`dupscan: ${label}: expected an allow-list object`); process.exit(1); }
  for (const [key, entry] of Object.entries(list)) {
    if (!Number.isSafeInteger(entry?.count) || entry.count < 0) {
      console.error(`dupscan: ${label}: count must be a non-negative integer: ${key}`);
      process.exit(1);
    }
  }
}

/** The allow-list on the base commit, or why it cannot be read. */
function readBaseAllow() {
  const rel = relative(repo, allowPath);
  if (rel.startsWith('..')) return {error: `the allow-list ${allowPath} is not inside ${repo}, so it cannot be compared with the base`};
  try { return {list: JSON.parse(execFileSync('git', ['-C', repo, 'show', `${baseRef}:${rel}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}))}; }
  catch (e) { return {error: `cannot read ${rel} at the base ${baseRef}: ${String(e.stderr ?? e.message).trim()}`}; }
}

/** Materialise the tracked source blobs directly so export attributes cannot hide or rewrite them. */
function writeBaseSources(tree) {
  mkdirSync(join(tree, 'packages'), {recursive: true});
  const entries = execFileSync('git', ['-C', repo, 'ls-tree', '-rz', baseRef, '--', 'packages'],
    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']});
  for (const entry of entries.split('\0')) {
    const tab = entry.indexOf('\t');
    const path = entry.slice(tab + 1);
    const [mode, , blob] = entry.slice(0, tab).split(' ');
    if (!/^100[0-7]{3}$/.test(mode) || !isCopySource(path)) continue;
    const dest = join(tree, path);
    mkdirSync(dirname(dest), {recursive: true});
    const fd = openSync(dest, 'w');
    try {
      execFileSync('git', ['-C', repo, 'cat-file', 'blob', blob], {stdio: ['ignore', fd, 'inherit']});
    } finally {
      closeSync(fd);
    }
  }
}

/** How many times each key is found on the base tree, outside the homes declared on that tree. */
function scanBase() {
  const dir = mkdtempSync(join(tmpdir(), 'dupscan-base-'));
  const tree = join(dir, 'tree'), homes = join(dir, 'homes.json'), found = join(dir, 'found.json');
  try {
    writeBaseSources(tree);
    const rel = relative(repo, resolve(homesPath));
    writeFileSync(homes, execFileSync('git', ['-C', repo, 'show', `${baseRef}:${rel}`], {stdio: ['ignore', 'pipe', 'inherit']}));
    try {
      // Use the same recorded keys to group comment-spanning lines on both revisions. Homes still come from the base.
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), tree, '--jscpd', jscpdBin, '--homes', homes,
        '--allow', resolve(allowPath), '--list-findings', found], {stdio: ['ignore', 'ignore', 'inherit']});
    } catch (error) {
      if (error.status !== 1) throw error;
      console.error(`dupscan: the source scan failed on the base ${baseRef}`);
      return null;
    }
    return JSON.parse(readFileSync(found, 'utf8'));
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

/** Why the allow-list grew against the one on the base commit (T934: it may only shrink). */
function ratchetAgainstBase() {
  if (baseAllow.list === undefined) return [baseAllow.error];
  const base = baseAllow.list;
  const out = [];
  // A key's scope: its kind, rule and file (sig|rule|file), or for a copy its two files (copy|a|b).
  const scope = k => k.split('|').slice(0, 3).join('|');
  const claims = new Map();
  for (const [k, e] of Object.entries(allowFile)) if (!(k in base) && typeof e.was === 'string') claims.set(e.was, [...(claims.get(e.was) ?? []), k]);
  /** Why entry k's "was" is not one finding moving to its new key, or null when it is. */
  const wasProblem = (k, e) => {
    const b = base[e.was];
    if (b === undefined || b.resolved === true || e.was in allowFile) return `new entry (its "was" ${e.was} is not an unresolved base entry this one replaces): ${k}`;
    if (scope(e.was) !== scope(k)) return `new entry (its "was" is another rule or another file, not this finding's old key): ${k}`;
    if (claims.get(e.was).length !== 1) return `new entry (its "was" is claimed by ${claims.get(e.was).length} entries; one old key moves to one new key): ${k}`;
    if (rekey[e.was] !== k) return `new entry (its "was" and this key are not a pair in the reviewed re-key mapping; a re-key moves the same finding, unchanged since the base): ${k}`;
    if (e.count > b.count) return `count raised from ${b.count} to ${e.count} (through "was"): ${k}`;
    return null;
  };
  const movedTo = new Map([...claims].filter(([, ks]) => ks.length === 1 && wasProblem(ks[0], allowFile[ks[0]]) === null).map(([was, ks]) => [was, ks[0]]));
  for (const [k, b] of Object.entries(base)) {
    const e = allowFile[k];
    if (b.resolved === true) {
      if (e === undefined) out.push(claims.has(k) ? `resolved entry replaced (a resolved entry's history is never replaced): ${k}` : `deleted (never delete an entry: mark it resolved): ${k}`);
      else if (e.resolved !== true) out.push(`resolved on the base, unresolved here: ${k}`);
      else for (const f of ['resolved_to', 'resolved_by', 'ruling']) if (e[f] !== b[f]) out.push(`resolved entry rewritten (${f} changed): ${k}`);
    } else if (e === undefined) {
      if (!movedTo.has(k)) out.push(`deleted (never delete an entry: mark it resolved): ${k}`);
    } else if (e.resolved !== true && e.count > b.count) out.push(`count raised from ${b.count} to ${e.count}: ${k}`);
  }
  for (const [k, e] of Object.entries(allowFile)) {
    if (e.resolved !== true && movedAway(k)) out.push(`listed under a previous-form key the reviewed re-key mapping moves to ${rekey[k]} (list the entry under that key, "was": this one): ${k}`);
    if (k in base) continue;
    if (typeof e.was === 'string') { const why = wasProblem(k, e); if (why !== null) out.push(why); continue; }
    if (e.resolved === true) continue;   // a new resolved entry allows nothing
    if (typeof e.reason === 'string' && e.reason.startsWith('help text, no code')) {
      const matched = findings.filter(f => f.key === k);
      if (matched.length > 0 && matched.every(f => f.kind === 'signature' && f.prose)) continue;
      out.push(`new entry (its reason says help text, but the match is code, not inside a string or comment): ${k}`);
      continue;
    }
    out.push(`new entry: ${k}`);
  }
  return out;
}

console.log(`dupscan: ${findings.length} findings (${findings.filter(f => f.kind === 'copy').length} copies, ${findings.filter(f => f.kind === 'signature').length} formula signatures, ${inHome.length} of them in their kind's home), ${Object.keys(allow).length} allowed, ${Object.keys(resolved).length} resolved, ${gone.length} gone`);
for (const [rule, layers] of Object.entries(groups)) console.log(`  ${rule.padEnd(26)} in: ${[...layers].join(', ')}`);
const homesOf = rule => homeSpans.filter(h => h.rule === rule).map(h => h.home).filter((h, i, all) => all.indexOf(h) === i);
const where = f => {
  if (f.kind === 'copy') return `copy ${f.lines} lines: ${f.where}`;
  const homes = homesOf(f.rule);
  return `${f.rule} (${f.layer}) ${f.where}: ${f.what}${homes.length ? `\n    the engine's home for this sum: call ${homes.join(' or ')}` : ''}`;
};
if (homeErrors.length) {
  console.log(`\nFAIL: ${homeErrors.length} declared homes are wrong (${homesPath}); a home is one engine declaration, file:name, that exists once:`);
  for (const e of homeErrors) console.log(`  ${e}`);
}
if (ratchet.length) {
  console.log(`\nFAIL: the allow-list (${allowPath}) grew against ${baseRef}; it only shrinks (T934; only a help-text entry, reason "help text, no code", may be added):`);
  for (const e of ratchet) console.log(`  ${e}`);
}
if (incomplete.length) {
  console.log(`\nFAIL: ${incomplete.length} resolved allow-list entries lack resolved_to, resolved_by or ruling (${allowPath}):`);
  for (const k of incomplete) console.log(`  ${resolved[k].where}  ${k.slice(0, 140)}`);
}
if (knownLargeCopies.length) {
  console.log(`\nnote: ${knownLargeCopies.length} copies outside jscpd's previous file limits already exist on the base:`);
  for (const f of knownLargeCopies) console.log(`  ${where(f)}`);
}
// Gone copies pass (T941, QO963): they are reported so the consolidation is visible, and need no edit to the allow-list.
const note = k => `  ${allow[k].where}  ${k.slice(0, 140)}${k in homeOfKey ? `\n    this line is inside its kind's home (${homeOfKey[k]})` : ''}`;
if (goneNow.length) {
  console.log(`\nnote: ${goneNow.length} allowed copies are gone with this change (resolved by this change; the allow-list needs no edit, and the copy coming back would fail):`);
  for (const k of goneNow) console.log(note(k));
}
if (goneAlready.length) {
  console.log(`\nnote: ${goneAlready.length} allowed entries match nothing, and matched nothing on the base either (copy removed earlier or line edited; nothing to do, and the copy coming back would fail):`);
  for (const k of goneAlready) console.log(note(k));
}
if (returned.length) {
  console.log(`\nFAIL: ${returned.length} copies that were gone on the base (${baseRef}) are back; an allowed entry is not a licence once its copy has gone (QO949):`);
  for (const f of returned) console.log(`  ${where(f)}`);
}
if (back.length) {
  console.log(`\nFAIL: ${back.length} consolidated copies are back:`);
  for (const f of back) { const e = resolvedEntryOf(f); console.log(`  ${where(f)}\n    this copy was consolidated into ${e.resolved_to} by ${e.resolved_by}; call ${e.resolved_to}`); }
}
if (newOnes.length) {
  console.log(`\nFAIL: ${newOnes.length} new duplicated logic not in the allow-list (${allowPath}):`);
  for (const f of newOnes) console.log(`  ${where(f)}`);
  console.log('\nCall the engine function that owns the sum (move the calculation into the engine first if it has none). The allow-list only shrinks: a new entry is refused.');
}
if (homeErrors.length || ratchet.length || incomplete.length || back.length || unlisted.length) process.exit(1);
console.log('\nOK: no new duplicated logic.');
