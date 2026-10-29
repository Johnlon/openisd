import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = root + 'build/ui-contract/rendition-branch/closed-box/';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[char]));
let page = await readFile(root + 'docs/design/field-rendition-branch-review.html', 'utf8');
const records = [];
for (const site of ['prod', 'test', 'local']) for (const skin of ['mobile', 'desktop']) {
  const record = JSON.parse(await readFile(output + site + '-' + skin + '-closed-box.json', 'utf8'));
  records.push(record);
  page = page.replace('{{BUILD:' + site + '-' + skin + '}}', escape(JSON.stringify(record.build)));
}
const projectHashes = new Set(records.map(record => record.projectSha));
if (projectHashes.size !== 1) throw new Error('Comparison requires identical project bytes across every site and viewport');
page = page.replace('{{PROJECT_SHA}}', escape(records[0].projectSha));
if (page.includes('{{')) throw new Error('Unfilled comparison template token');
await writeFile(output + 'index.html', page);
console.log('Published six same-project closed-box pictures with per-picture comments; review remains provisional.');
