# BUG_20260922_box-tab-loss-model-select-too-narrow

**Status:** RESOLVED

## Symptom
On the Box tab, the sealed-box "Model" (loss model) dropdown is too narrow for its
own option text — "Conventional Lossy" is cut off ("...ossy" clipped).

## Evidence
[OriginalShell.vue:249](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OriginalShell.vue#L249):
```
<select id="lossmode" :value="lossMode" @change="..." style="width:130px">
  <option v-for="m in LOSS_MODE_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
</select>
```
Hard-coded `width:130px`. Option labels come from
[lossMode.ts:30-32](http://localhost:8000/winisd/openisd/packages/design/engine/lossMode.ts#L30-L32):
```
static readonly Lossless = new LossMode('lossless', 'Lossless');
static readonly ConventionalLossy = new LossMode('conventional-lossy', 'Conventional Lossy');
static readonly WinisdLossy = new LossMode('winisd-lossy', 'WinISD Lossy');
```
"Conventional Lossy" (18 characters) does not fit a 130px-wide `<select>`, which
clips the selected option's text rather than wrapping.

## Cause
Fixed pixel width on the `<select>` is narrower than its longest option label.

## Fix
[OriginalShell.vue:249](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OriginalShell.vue?html#L249)
— widened `#lossmode` from `width:130px` to `width:170px`, matching the Box Type select's
170px at [OriginalShell.vue:243](http://localhost:8000/winisd/openisd/packages/ui/src/ui/shells/original/OriginalShell.vue?html#L243).

## Verification
Pure CSS width fix — outside this project's logic-focused TDD tiers (no test covers rendered
select width). Verified by reading the rule: 170px matches the Box Type select which already
fits its own longest label; "Conventional Lossy" is shorter than that select's longest option.
`npm run typecheck` — `ui` clean (template-only change, no logic touched).
