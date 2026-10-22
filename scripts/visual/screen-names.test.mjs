// node scripts/visual/screen-names.test.mjs: every baseline name (one per screen in SCREENS, packages/ui/test/visual/screens.ts)
// has a plain name, and the group key / leader rules hold. Exit 0 = pass.
import {readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {groupKey, groupLeaders} from './groups.mjs';
import {plainScreenName} from './screen-names.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const snapshots = resolve(root, 'packages/ui/test/visual/visual.browser.spec.ts-snapshots');
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const names = readdirSync(snapshots).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, ''));
check(names.length >= 60, `expected the baselines of every screen, found ${names.length}`);
const seen = new Map();
for (const name of names) {
  const warnings = [];
  const plain = plainScreenName(name, w => warnings.push(w));
  check(warnings.length === 0, `${name}: ${warnings.join('; ')}`);
  check(!/[a-z]+-[a-z0-9]+/.test(plain) || /4th|6th/.test(plain), `${name}: plain name still looks like a file name: ${plain}`);
  check(!seen.has(plain), `${name} and ${seen.get(plain)} have the same plain name: ${plain}`);
  seen.set(plain, name);
}
const want = {
  'desktop-wizard-abc-step3': 'Desktop, New project wizard, ABC box, step 3',
  'desktop-wizard-sealed-step1': 'Desktop, New project wizard, step 1',
  'desktop-tab-filters': 'Desktop, Filters tab',
  'desktop-box-sealed': 'Desktop, sealed box project',
  'desktop-box-box-passive-radiator': 'Desktop, passive radiator box project',
  'desktop-box-bandpass4': 'Desktop, 4th order bandpass box project',
  'desktop-box-bandpass6': 'Desktop, 6th order bandpass box project',
  'desktop-empty': 'Desktop, no project open',
  'mobile-menu': 'Phone, menu',
};
for (const [name, plain] of Object.entries(want)) check(plainScreenName(name) === plain, `${name} -> ${plainScreenName(name)}, wanted ${plain}`);
const warned = [];
check(plainScreenName('desktop-something-new', w => warned.push(w)) === 'desktop-something-new' && warned.length === 1, 'an unknown name falls back to the raw name and warns');

// Grouping: the union box of before and after, edges rounded to 32 px.
const box = (b, a) => ({before: b, after: a});
check(groupKey(box([[100, 100, 50, 20], [400, 300, 10, 10]], [[102, 98, 50, 20]])) === groupKey(box([[101, 99, 50, 20]], [[100, 100, 50, 20], [398, 302, 12, 8]])),
  'extra small boxes and small shifts do not change the group');
check(groupKey(box([[100, 100, 50, 20]], [])) !== groupKey(box([[100, 600, 50, 20]], [])), 'a change somewhere else is another group');
check(groupKey(null) === null, 'no box, no key');
const leaders = groupLeaders([
  {name: 'b', box: box([[100, 100, 50, 20], [110, 105, 5, 5]], [[100, 100, 50, 20]])},
  {name: 'c', box: box([[100, 100, 50, 20]], [[100, 100, 50, 20]])},
  {name: 'a', box: box([[100, 100, 50, 20]], [[100, 100, 50, 20]])},
  {name: 'z', box: null},
]);
check(JSON.stringify(leaders) === '[2,2,2,3]', `leader is the fewest boxes, ties by name: ${JSON.stringify(leaders)}`);

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('screen-names: ok');
