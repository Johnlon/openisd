import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const {parse: parseSfc} = require('@vue/compiler-sfc');
const {parse: parseTemplate, NodeTypes} = require('@vue/compiler-dom');
const paths = execFileSync('rg', ['--files', 'packages/ui/src/ui', '-g', '*.vue'], {cwd: root, encoding: 'utf8'}).trim().split('\n').sort();
const valueTags = new Set(['input', 'select', 'textarea', 'meter']);
const valueRoles = new Set(['checkbox', 'switch', 'spinbutton', 'textbox', 'combobox', 'slider']);
const numericPrimitives = new Set(['NumInput.vue', 'NumReadout.vue', 'UIFieldBody.vue', 'UnitToggle.vue', 'WinisdDeviationCue.vue'].map(name => 'packages/ui/src/ui/components/' + name));
const valueComponentTags = new Set(['UIField', 'UIFixedField', 'UISettlingField', 'UIPickField', 'NumInput', 'NumReadout']);
const entries = [];
const dynamicElements = [];
const dynamicSemantics = [];
const spreadBindings = [];
const valueComponentUses = [];
const templatesHash = createHash('sha256');

for (const path of paths) {
  const source = readFileSync(root + path, 'utf8');
  templatesHash.update(path + '\0').update(source).update('\0');
  const {descriptor, errors} = parseSfc(source, {filename: path});
  if (errors.length) throw new Error(path + ': SFC parse error');
  if (!descriptor.template) continue;
  const ast = parseTemplate(descriptor.template.content);

  function walk(node, parents = []) {
    if (node.type === NodeTypes.ELEMENT) {
      const attributes = Object.fromEntries(node.props.filter(prop => prop.type === NodeTypes.ATTRIBUTE).map(prop => [prop.name, prop.value?.content ?? '']));
      const bindings = node.props.filter(prop => prop.type === NodeTypes.DIRECTIVE).map(prop => ({directive: prop.name, arg: prop.arg?.content ?? null, expression: prop.exp?.content ?? null}));
      const location = {path, line: descriptor.template.loc.start.line + node.loc.start.line - 1, tag: node.tag};
      if (valueComponentTags.has(node.tag)) valueComponentUses.push({...location, attributes, bindings});
      if (bindings.some(prop => prop.directive === 'bind' && prop.arg === null)) spreadBindings.push({...location, bindings});
      if (node.tag === 'component') dynamicElements.push({...location, bindings});
      if (bindings.some(prop => prop.arg === 'role' || prop.arg === 'contenteditable')) dynamicSemantics.push({...location, bindings});
      const readoutClass = node.tag === node.tag.toLowerCase() && /(?:^|\s)(?:mob-readonly|catalogue-colour-readout)(?:\s|$)/.test(attributes.class ?? '');
      const sharedReadoutBranch = path === 'packages/ui/src/ui/components/NumReadout.vue' && node.tag === 'span' && parents.length === 0;
      if (valueTags.has(node.tag) || valueRoles.has(attributes.role) || attributes.contenteditable === 'true' || readoutClass || sharedReadoutBranch) {
        const inputType = attributes.type ?? (bindings.some(prop => prop.arg === 'type') ? 'dynamic' : 'default');
        const actionInput = node.tag === 'input' && ['file', 'hidden', 'button', 'submit', 'reset'].includes(inputType);
        const classification = actionInput ? 'action or hidden input'
          : numericPrimitives.has(path) ? 'shared numeric/field primitive'
          : path === 'packages/ui/src/ui/components/FieldCatalogue.vue' ? 'prototype catalogue'
          : 'host or other component requiring family/ownership reconciliation';
        entries.push({...location, inputType, role: attributes.role ?? null, attributes, bindings,
          enclosingComponents: parents.filter(parent => parent.tag !== parent.tag.toLowerCase()).map(parent => parent.tag), classification});
      }
    }
    const ancestors = node.type === NodeTypes.ELEMENT ? [...parents, node] : parents;
    for (const child of node.children ?? []) walk(child, ancestors);
  }
  walk(ast);
}
if (entries.length === 0) throw new Error('Source inventory must not be empty');
const report = {
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  templateSourcesSha256: templatesHash.digest('hex'),
  generatorSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  parserVersion: require('@vue/compiler-sfc/package.json').version,
  trackedApplicationDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'packages/ui/src', 'packages/design'], {cwd: root})).digest('hex'),
  diffScope: 'Tracked application files, staged and unstaged. The separate templateSourcesSha256 includes every discovered template, including untracked templates.',
  scope: 'Vue template source discovery only. Loop cardinality, runtime visibility, contextual capability, TS render functions and complete host/state coverage remain to reconcile. Actions and dynamic semantics are retained separately.',
  templates: paths.length,
  valueAndActionInputDeclarations: entries.length,
  dynamicElements,
  dynamicSemantics,
  spreadBindings,
  valueComponentUses,
  entries,
};
mkdirSync(root + 'build/ui-contract', {recursive: true});
const snapshotId = createHash('sha256').update(JSON.stringify(report)).digest('hex');
const snapshotPath = 'build/ui-contract/source-inventory-snapshots/' + snapshotId + '.json';
mkdirSync(root + 'build/ui-contract/source-inventory-snapshots', {recursive: true});
const serialized = JSON.stringify(report, null, 2);
if (existsSync(root + snapshotPath)) {
  if (readFileSync(root + snapshotPath, 'utf8') !== serialized) throw new Error('Refusing to change an existing source snapshot');
} else writeFileSync(root + snapshotPath, serialized, {flag: 'wx'});
writeFileSync(root + 'build/ui-contract/control-source-inventory.json', JSON.stringify({...report, snapshotPath}, null, 2));
const counts = new Map();
for (const entry of entries) counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
const classifications = Object.fromEntries([...new Set(entries.map(entry => entry.classification))].map(category => [category, entries.filter(entry => entry.classification === category).length]));
console.log(JSON.stringify({templates: paths.length, declarations: entries.length, dynamicElements: dynamicElements.length, dynamicSemantics: dynamicSemantics.length, spreadBindings: spreadBindings.length, valueComponentUses: valueComponentUses.length, snapshotPath, classifications, files: [...counts].sort((a, b) => b[1] - a[1])}));
