// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * A unit beside a shown value comes from the unit rotation, never from text typed in a template
 * or a hook.
 *
 * A value shown with a hand-typed " Hz" or " L" does not follow the unit the user picked, and a
 * second skin would have to retype every one. The unit label is `NumberField.unitLabel(token)`,
 * `UnitToggle`, or a `ReadoutFormat` method; the number converts with it.
 *
 * What counts as a unit symbol is read from the design package (every label in `UNIT_GROUPS`
 * and every fixed symbol a `NumberField` declares), so this list cannot drift from the registry.
 * Three shapes are reported, in templates and in `.ts` files under `packages/ui/src`:
 *  - template text straight after an interpolation that starts with a unit (`{{ v }} Hz`);
 *  - a string literal that is a unit, or ends with one (`' Hz'`, `'— dB'`), and a template
 *    literal piece straight after a `${}` that starts with one (`${v} Hz`);
 *  - an element classed as a unit (`class="unit"`, `ro-hz-unit`, `u`) whose only content is a
 *    unit symbol (`<span class="unit">L</span>`).
 * A static label that is not beside a value and not classed as a unit (a table heading, a help
 * sentence) is not reported: a test cannot tell it from a unit label without a list of files.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {parse as parseSfc} from '@vue/compiler-sfc';
import {NodeTypes, parse as parseTemplate, type ParentNode, type TemplateChildNode} from '@vue/compiler-dom';
import {Node, Project as TsProject, SyntaxKind} from 'ts-morph';
import {NumberField, UNIT_GROUPS} from '@openisd/design/fields';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const UNIT_SYMBOLS: readonly string[] = [...new Set([
  ...Object.values(UNIT_GROUPS).flatMap(units => units.map(u => u.label)),
  ...NumberField.ALL.flatMap(f => (f.display.kind === 'fixed' && f.display.symbol !== '' ? [f.display.symbol] : [])),
])];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SYMBOL = `(?:${[...UNIT_SYMBOLS_BY_LENGTH()].map(escape).join('|')})`;
function UNIT_SYMBOLS_BY_LENGTH(): string[] {
  return [...UNIT_SYMBOLS].sort((a, b) => b.length - a.length);
}
/** Text that begins with a unit symbol: `Hz`, ` L — suitable`, `Ω` is not a registry symbol. */
const STARTS_WITH_UNIT = new RegExp(`^\\s*${SYMBOL}(?![A-Za-z0-9])`, 'i');
/** Text that is, or ends with, a unit symbol after a space or a dash: `Hz`, `— dB`, ` L`. */
const ENDS_WITH_UNIT = new RegExp(`(?:^|[\\s—–-])${SYMBOL}$`, 'i');
const IS_UNIT = new RegExp(`^\\s*${SYMBOL}\\s*$`, 'i');
const UNIT_CLASS = /(^|[\s-])u(nit)?($|[\s-])|unit/;

function filesUnder(dir: string, extension: string): string[] {
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(extension)) out.push(full);
    }
  })(dir);
  return out;
}

const scratch = new TsProject({useInMemoryFileSystem: true, compilerOptions: {allowJs: true}});

/** `'g'` in `new RegExp(pattern, 'g')` is a flag, not grams. */
function isRegExpFlags(lit: Node): boolean {
  const call = lit.getParent();
  return call !== undefined && Node.isNewExpression(call) && call.getExpression().getText() === 'RegExp'
    && call.getArguments()[1] === lit;
}

/** The unit-shaped string pieces of one TypeScript source text. */
function literalOffences(source: string): {what: string; line: number}[] {
  const file = scratch.createSourceFile('source.ts', source, {overwrite: true});
  const found: {what: string; line: number}[] = [];
  const lineOf = (n: {getStartLineNumber(): number}) => n.getStartLineNumber();
  for (const lit of [
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ]) {
    if (isRegExpFlags(lit)) continue;
    const text = lit.getLiteralText();
    if (IS_UNIT.test(text) || ENDS_WITH_UNIT.test(text)) found.push({what: `literal ${JSON.stringify(text)}`, line: lineOf(lit)});
  }
  for (const span of file.getDescendantsOfKind(SyntaxKind.TemplateSpan)) {
    const text = span.getLiteral().getLiteralText();
    if (STARTS_WITH_UNIT.test(text)) found.push({what: `template piece ${JSON.stringify(text)} after a value`, line: lineOf(span)});
  }
  return found;
}

function expressionsOf(root: ParentNode): {text: string; line: number}[] {
  const out: {text: string; line: number}[] = [];
  const visit = (node: ParentNode | TemplateChildNode) => {
    if (node.type === NodeTypes.INTERPOLATION && node.content.type === NodeTypes.SIMPLE_EXPRESSION) {
      out.push({text: node.content.content, line: node.content.loc.start.line});
    }
    if (node.type === NodeTypes.ELEMENT) {
      for (const prop of node.props) {
        if (prop.type !== NodeTypes.DIRECTIVE) continue;
        for (const part of [prop.exp, prop.arg]) {
          if (part !== undefined && part.type === NodeTypes.SIMPLE_EXPRESSION && !part.isStatic) {
            out.push({text: part.content, line: part.loc.start.line});
          }
        }
      }
    }
    if ('children' in node) {
      for (const child of node.children) {
        if (typeof child === 'string' || typeof child === 'symbol') continue;
        if (child.type === NodeTypes.SIMPLE_EXPRESSION) continue;
        visit(child);
      }
    }
  };
  visit(root);
  return out;
}

/** Text straight after an interpolation, and unit-classed elements holding only a unit. */
function structuralOffences(root: ParentNode): {what: string; line: number}[] {
  const found: {what: string; line: number}[] = [];
  const visit = (node: ParentNode | TemplateChildNode) => {
    if (node.type === NodeTypes.ELEMENT) {
      const cls = node.props.find(p => p.type === NodeTypes.ATTRIBUTE && p.name === 'class');
      const classText = cls !== undefined && cls.type === NodeTypes.ATTRIBUTE ? (cls.value?.content ?? '') : '';
      const only = node.children.length === 1 ? node.children[0] : undefined;
      if (UNIT_CLASS.test(classText) && only !== undefined && only.type === NodeTypes.TEXT && IS_UNIT.test(only.content)) {
        found.push({what: `<${node.tag} class="${classText}">${only.content.trim()}</${node.tag}>`, line: node.loc.start.line});
      }
    }
    if ('children' in node) {
      const kids = node.children.filter((c): c is TemplateChildNode => typeof c !== 'string' && typeof c !== 'symbol');
      kids.forEach((child, i) => {
        const before = kids[i - 1];
        if (child.type === NodeTypes.TEXT && before !== undefined && before.type === NodeTypes.INTERPOLATION
          && STARTS_WITH_UNIT.test(child.content)) {
          found.push({what: `text ${JSON.stringify(child.content.trim())} after {{ … }}`, line: child.loc.start.line});
        }
        visit(child);
      });
    }
  };
  visit(root);
  return found;
}

describe('units come from the rotation', () => {
  it('no template or hook types a unit beside a shown value', () => {
    const offences: string[] = [];
    for (const file of filesUnder(UI_SRC, '.vue')) {
      const {descriptor} = parseSfc(readFileSync(file, 'utf8'));
      if (descriptor.template === null) continue;
      const base = descriptor.template.loc.start.line - 1;
      const root = parseTemplate(descriptor.template.content);
      for (const {what, line} of structuralOffences(root)) offences.push(`${relative(UI_SRC, file)}:${base + line} ${what}`);
      for (const {text, line} of expressionsOf(root)) {
        for (const o of literalOffences(`(${text});`)) offences.push(`${relative(UI_SRC, file)}:${base + line} ${o.what}`);
      }
    }
    for (const file of filesUnder(UI_SRC, '.ts')) {
      for (const o of literalOffences(readFileSync(file, 'utf8'))) offences.push(`${relative(UI_SRC, file)}:${o.line} ${o.what}`);
    }
    assert.deepEqual(offences.sort(), [], [
      'A unit is typed beside a value. Take the label from the field (`NumberField.unitLabel(token)`,',
      '`UnitToggle`) or a `ReadoutFormat`, so the unit follows the rotation and a second skin does',
      'not retype it.',
    ].join(' '));
  });
});
