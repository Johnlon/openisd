# Mobile surface manifest

Published inspection page: http://lap:8000/winisd/openisd-t607/build/ui-manifest/mobile/
Machine-readable data: http://lap:8000/winisd/openisd-t607/build/ui-manifest/mobile/manifest.json?raw

The shared declarations are in `packages/ui/test/fixtures/mobileSurfaceManifest.ts`.
`mobileSurfaceNavigation.ts` opens the registered routes through the real UI.
`mobile-surface-manifest.browser.spec.ts` consumes that same list. Adding a surface must
not mean maintaining a separate human list and a separate browser-test list.

The publication combines declared page/box/wizard/editor/filter/chart variants, generated
in-app help and field descriptions, every file under `docs/` plus repository-wide Markdown/text/HTML/PDF guides and bug records,
static/dynamic link declarations, and source-discovered popup/native/conditional roots.
All conditional branches are retained, including anonymous ones, so minor UI cannot be
excluded merely by lacking a familiar modal class. Shared templates retain branches that
still require mobile-versus-desktop applicability reconciliation. Browser/OS-owned file,
colour, select and keyboard/selection UI are declared separately from app DOM.

This is an inventory, not a claim that every row is an independent page or that every
surface has been visited or conforms. Source branches and documentation are separate
categories from user-visible declared surfaces. Data-dependent driver details, cloud
history/conflicts, diagnostics and confirmations are families, not an infinite list of
possible project values. Gaps must stay visible. Native/search/compound field contexts
still require reconciliation for the mobile appearance/empty-cue-rail work.

Commands (from the task worktree):

```
node node_modules/tsx/dist/cli.mjs scripts/publish-mobile-surface-manifest.ts
bash scripts/test.sh packages/ui/test/scripts/mobile-surface-manifest.test.ts
bash scripts/test.sh packages/ui/test/ui/mobile-surface-manifest.browser.spec.ts
node node_modules/tsx/dist/cli.mjs scripts/record-mobile-surface-visits.ts
node node_modules/tsx/dist/cli.mjs scripts/publish-mobile-surface-manifest.ts
```

A real browser is required for computed font/geometry and actual navigation. These targeted
runs use the repository's resource limits, not the obsolete outer heavy-lane wrapper or
a full-suite admission queue. Static inventory/document discovery is a Node/unit task.
The first 48 registered visits passed in 51.6 seconds of browser time, about 61 seconds including
building the test app. The ten additional filter-card visits passed in 15.7 seconds, 25 seconds
including building. All 58 registered routes have passing evidence. The four scanner/index checks
took 1.80 seconds for the full unit process, with about 680ms spent in assertions. This measures visits
and visible roots; it does not prove full visual/functional conformance.

The source/docs index gate records known source-root IDs and documentation paths. A new
conditional/popup/doc causes the gate to fail until the inventory is explicitly updated.
Updating inventory is not approval of appearance/use cases. Catalogue approval and the
left warning-rail placement question remain separate and pending.

Current publication: 155 declared surfaces/variants, 260 help/field descriptions (numeric,
text, enum, toggle and date fields), 942 documentation files/assets, 595 source roots/branches,
and 24 template link declarations. These categories must not be added together and called pages.
Runtime evidence is retained across targeted runs; each visited row states outcome and duration.


The inspection page follows the app journey: start/manage projects → choose/edit the driver →
design the enclosure → signal/filters → results/Tune/What-if → settings/data → help/recovery →
shared interactions. Minor popups sit with their owning task; each enclosure includes its
chamber-loss dialogs. `mobileSurfaceFlow.ts` provides the order and the JSON publication
includes the same chapter/group IDs. A gate requires every declared surface to appear once
and rejects unplaced new surfaces. This is presentation order, not approval of use cases.

Full help/field text, repository documentation, source branches and resource links remain in
expandable reference sections, with folder/file grouping. Search covers all entries and opens
matching groups and reference sections. Clearing search restores the previous open/closed
state. Expand/collapse buttons and chapter links support inspection on a phone. Existing
navigation outcomes and gaps are preserved; no app navigation or appearance was changed.


Illustrated draft (separate from the original document John is reading):
http://lap:8000/winisd/openisd-t607/build/ui-manifest/mobile-visual-draft/

The draft is screenshot-first. Functional areas are Project Creation Wizard, Manage Projects
(including Project Import/Export), Project Views, Manage Drivers (including Driver Import/Export),
Settings and Cloud, Help and Recovery, and Shared Interactions. Mobile and Desktop have independent
lists and platform-qualified identities. A shared purpose is an explicit relationship, not a
one-to-one pairing. For example, separate desktop Box/Vents tabs relate to one mobile Box page;
desktop graphs are embedded workspace regions, not invented desktop Graph pages. Import is marked
as an action entry point; a headless app screenshot does not show the OS file picker.

Every actual image has its own comment composer. Legacy IDs remain aliases for captured/test
records. Guarded/system/native-device cases remain visible as gaps. Images show initial viewports,
not full scrolling-content coverage. Production references and preview snapshots are independently
labelled with build, capture time, viewport and imported-project hash; wizard scenarios additionally
choose Tang Band W5-1138SMF. The original mobile manifest is preserved unchanged while read.

After John's report of an inside cue in the document, the draft now defaults to preview-only.
Production requires explicit selection; a sticky source/build caption remains visible with each
image. Images use capture timestamps in their URLs to avoid stale cached reload frames. The real
lap:4607 wizard was rechecked: build v20261027T1419Z, control right258/cue left260, outside=true.
The reported picture is the production reference v20261025T2233Z. The document's prior ordering
and scrolling caption made that distinction too easy to lose; that was a presentation failure.

A real-wizard mutation demonstrated that the shared DOM detector accepted a cue inside an input
when it did not overlap the digits (red172040). The detector now requires the model cue to follow
the full value/unit/spinner group; wizard baseline and mutation both pass172201. This strengthens
existing page checks, but does not make screenshot capture a conformance test.

The requested Gemini read-only image/source critique was attempted through the installed Gemini
CLI. It failed before review with UNSUPPORTED_CLIENT/IneligibleTierError. No independent visual
approval is claimed. The local failure log is retained in the illustrated draft's artifacts.


Inventory-count correction (John's question after comparing Mobile and Desktop): the current
157 mobile versus117 desktop entries do not establish40 extra mobile views. Mobile includes
five browser/OS families and more shared/error/popup states; desktop currently omits several
of those same families. Both lists include30 wizard path/step entries (five steps across six
enclosure types), not30 different wizard screens. Functional chapter counts currently differ
as follows: wizard34/30,projects8/6,project views71/63,drivers16/8,settings7/5,help13/4,shared8/1.
Some differences are genuine presentation differences; the totals cannot separate those from
inventory omissions. The publication now labels entries rather than distinct-screen counts.
A defensible platform comparison requires separate counts for view families, variants, action
entry points and browser/system states, plus explicit source-backed reconciliation. Do not add
invented desktop entries merely to balance totals, or force one-to-one relationships.
