// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect, then repair it.
// Casting past it, renaming so the matcher stops firing, adding an exemption or loosening the
// assertion are the same act under different names. See AGENTS.md "Every architecture test
// exists to catch the AI".

/**
 * A template shows what a hook or a design formatter hands it; it never rounds or computes.
 *
 * The ESLint rule on `packages/ui/src` bans `.toFixed(` and the physics `Math.*` functions in
 * script code, but ESLint cannot see a template expression. This gate parses every `.vue`
 * template, takes each expression (interpolation, directive value, directive argument) as a
 * TypeScript AST, and reports a call to `.toFixed` or a use of a banned `Math` member. No
 * allowlist: the number of decimals is a design decision, held in `packages/design`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, relative} from 'node:path';
import {parse as parseSfc} from '@vue/compiler-sfc';
import {NodeTypes, parse as parseTemplate, type ParentNode, type TemplateChildNode} from '@vue/compiler-dom';
import {Node, Project as TsProject, SyntaxKind} from 'ts-morph';

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const BANNED_MATH_MEMBERS: ReadonlySet<string> = new Set([
  'log', 'log10', 'log2', 'exp', 'pow', 'sqrt', 'hypot', 'PI', 'sin', 'cos', 'tan', 'atan', 'atan2',
]);

function vueFilesUnder(dir: string): string[] {
  const out: string[] = [];
  (function walk(current: string) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.vue')) out.push(full);
    }
  })(dir);
  return out;
}

/** Every expression text in a template, with the line it starts on. */
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

const scratch = new TsProject({useInMemoryFileSystem: true, compilerOptions: {allowJs: true}});

function offencesIn(expression: string): string[] {
  const file = scratch.createSourceFile('expression.ts', `(${expression});`, {overwrite: true});
  const found: string[] = [];
  for (const access of file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const member = access.getName();
    if (member === 'toFixed') found.push('.toFixed(');
    const owner = access.getExpression();
    if (Node.isIdentifier(owner) && owner.getText() === 'Math' && BANNED_MATH_MEMBERS.has(member)) {
      found.push(`Math.${member}`);
    }
  }
  return found;
}

describe('templates do no arithmetic', () => {
  it('no .vue template calls .toFixed or a physics Math function', () => {
    const offences: string[] = [];
    for (const file of vueFilesUnder(UI_SRC)) {
      const {descriptor} = parseSfc(readFileSync(file, 'utf8'));
      if (descriptor.template === null) continue;
      const root = parseTemplate(descriptor.template.content);
      for (const {text, line} of expressionsOf(root)) {
        for (const what of offencesIn(text)) {
          offences.push(`${relative(UI_SRC, file)}:${descriptor.template.loc.start.line + line - 1} ${what}`);
        }
      }
    }
    assert.deepEqual(offences, [], [
      'A template expression rounds or computes. The number of decimals is a design decision:',
      'give the template a string from a hook, or call a formatter from @openisd/design/fields.',
    ].join(' '));
  });
});
