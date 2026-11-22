import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = root + 'build/ui-contract/closed-box-focus-v1/';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[char]));
const pictures = [
  {name: 'prod', title: 'Production', note: 'No marker remains after blur. Refused zero and its explanation stay visible.'},
  {name: 'test', title: 'Live test', note: 'KNOWN LIVE TEST BUG: Qtc zero is hidden by the internal ≠W cue, and Fsc digits collide with its cue. No marker remains after blur, but the layout is still wrong; a DOM value of zero does not prove readable text.'},
  {name: 'branch-before', title: 'Branch before repair', note: 'BUG: the Qtc zero remains highlighted after focus moves to the Box tab. Other rendition changes are existing proposals.'},
  {name: 'branch-after', title: 'Branch after repair', note: 'The stale digit highlight is gone. Zero and the refusal explanation are preserved; this specific repair is beneficial and agrees with production.'},
];
const records = await Promise.all(pictures.map(async picture => ({...picture, record: JSON.parse(await readFile(output + picture.name + '.json', 'utf8'))})));
if (new Set(records.map(item => item.record.projectSha256)).size !== 1) throw new Error('All four captures must use identical project bytes');
for (const {name, record} of records) {
  if (record.state.value !== '0' || record.state.focused || record.state.marker !== (name === 'branch-before' ? 1 : 0) || record.errors.length !== 0) throw new Error('Unexpected focus comparison state: ' + name);
}
const manifest = records.map(({name, record}) => ({
  name,
  siteBuild: record.build,
  deployedSourceCommit: null,
  recorderWorktreeHead: record.sourceCheckpoint,
  branchApplicationBase: name.startsWith('branch') ? record.sourceCheckpoint : null,
  branchHookPatchSha256: name.startsWith('branch') ? record.workingDiffSha256 : null,
  patchScope: name.startsWith('branch') ? ['packages/ui/src/hooks/NumInput-hooks.ts'] : [],
  correction: 'Raw sourceCheckpoint is the recorder checkout; raw workingDiffSha256 hashes only the hook diff, never the whole dirty tree or a remote deployment.',
}));
await writeFile(output + 'capture-manifest.json', JSON.stringify(manifest, null, 2));
const identity = (name, record) => name.startsWith('branch')
  ? 'source ' + record.sourceCheckpoint.slice(0, 9) + ' + hook patch ' + record.workingDiffSha256.slice(0, 12) + ' (hook diff only; other dirty documentation/tests excluded)'
  : record.build.version + ' (deployed source commit unverified; local recorder commit is not the deployed commit)';
const figures = records.map(({name, title, note, record}) => `<figure data-picture="${name}"><h2>${title}</h2><a href="${name}.png"><img src="${name}.png" alt="${title}: Closed Box after entering refused Qtc zero and leaving focus"></a><figcaption><p>${note}</p><p>${escape(identity(name, record))}</p><p>Marker count ${record.state.marker}; native input focused ${record.state.focused}.</p><a href="${name}.json?raw">Original raw capture record (read metadata correction below)</a></figcaption><div class="comment"></div></figure>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Closed Box focus-loss review</title>
<style>body{font:15px/1.45 Arial,sans-serif;margin:12px;color:#222;background:#f3f4f5;overflow-wrap:anywhere}main{max-width:1600px;margin:auto}h1{font-size:24px}.pictures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0;padding:10px;background:#fff;border:1px solid #bbb;min-width:0}h2{font-size:18px}img{max-width:100%;height:auto}figcaption{font-size:13px;overflow-wrap:anywhere}.notice{background:#fff4d5;padding:12px;border:1px solid #c98}.comment textarea{box-sizing:border-box;width:100%;min-height:60px}@media(max-width:900px){.pictures{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.pictures{grid-template-columns:1fr}}</style>
<main><p><b>What to do: comment under any picture if the focus behaviour or comparison looks wrong.</b></p><h1>Closed Box only: refused values lose their cursor on blur</h1>
<p>Identical project SHA256 <code>${escape(records[0].record.projectSha256)}</code>; identical374×705 viewport. Each picture is taken after entering Qtc0 and touching the active Box tab to move focus away. Production/test use their actual service workers. The branch is the task preview at lap:4607. Capture records identify source and the exact hook patch hash; files are not overwritten.</p>
<p class="notice"><b>Specific repair verified; full rendition branch remains unfinished.</b> The only application change for this repair clears the selected-digit marker and cancels repeat after leaving the field, before an early return for refused text. Moving to its own spinners still retains the draft and chosen digit. No field style, width, cue placement, text or validation policy changed in this repair.</p>
<p><b>Personal comparison:</b> removing the branch's stale blue highlight is beneficial: the field no longer claims an active edit after focus has left, matching production/test. The refused zero and explanation remain. The branch-before/after pair otherwise retains the same proposed control layout. The existing branch-versus-production differences in widths, external cues, warning placement, error outline, label/control spacing, explanation typography and header/configuration are not approved by this repair. Production and live test also differ from one another. I am not attesting that every existing rendition difference is beneficial or that this page proves other pages/states.</p>
<div class="pictures">${figures}</div><p><b>Metadata correction:</b> the original raw JSON names were misleading. Its sourceCheckpoint identifies the local recorder checkout even for remote sites; its workingDiffSha256 is only the hook diff. It is not a full dirty-tree hash. The branch-before hook is unchanged (empty patch) while documentation/tests are dirty; the branch-after hook patch differs. Remote deployed commits were not measured. <a href="capture-manifest.json?raw">Corrected capture manifest</a> retains the original records and states these scopes explicitly. The DOM value check verifies state only; the live test picture visibly fails text readability.</p>
<p>Independent checks: refused-draft marker test red→green; selected ones-digit keyboard-hold blur test;24 affected caret/focus/spin browser checks. Full strategy, both Argon reports and dispositions: <a href="../../../docs/design/FIELD_APPEARANCE_CATALOGUE.md?html#L147">strategy and findings</a>. <a href="../../../docs/design/reviews/T607-argon-followup-review.txt">Argon focused source/image criticism</a>.</p>
</main><script src="/board/thread.js"></script><script>if(window.BoardThread){const store=BoardThread.store("QO305");for(const figure of document.querySelectorAll("figure")){const topic={kind:"picture",name:"T607/closed-box-focus-v1/"+figure.dataset.picture};figure.querySelector(".comment").append(store.compose({topic,label:"Comment on "+figure.dataset.picture,placeholder:"What is wrong, or better?"}),store.list({topic,order:"newest",replies:true}));}}</script></html>`;
await writeFile(output + 'index.html', html);
console.log('Published four immutable same-project focus pictures with one comment composer each.');
