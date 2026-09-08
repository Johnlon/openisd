# BUG: the passive radiator's "Fs (with added mass)" readout is always blank

Status: OPEN

## Symptom

On a passive-radiator project, the Enclosure tab's **Fpr (with added mass)** field shows
nothing, whatever the added mass is set to. WinISD shows a number here
(`docs/winisd_screenshots/view_3_passive_radiator.png`: "Fs (with added mass): 30.00 Hz"),
and it moves as the added mass changes — that is the whole point of the field, since adding
mass to the cone is how a PR is tuned.

## Evidence

`packages/ui/src/ui/shells/original/OriginalShell.vue:309`

```ts
const prFsMass_hz = computed<number | null>(() => null);
```

Bound at `OriginalShell.vue:1264`:

```html
<label>Fpr (with added mass):</label>
<input id="og-pr-fs-mass" class="calculated greyed"
       :value="fmtU(prFsMass_hz, 'prFsMass', 'freq', 'Hz', fieldDp('prFsMass'))" readonly>
```

`fieldRegistry.ts:193` declares the field and its formula, so the app states the quantity
exists and then never computes it:

```
id: 'prFsMass', label: 'Fpr (with added mass)', formula: 'Fpr = 1/(2π·√((Mmd+Madd)·Cms))',
dependsOn: ['prMmd', 'prMadd', 'prCms']
```

## Cause

`PassiveRadiatorBox` (`packages/design/domain/openisdDomain.ts:182-210`) publishes
`systemTuning_hz()` and `addedMassForTuning_kg(fp_hz)`, but nothing for the radiator's own
resonance once the tuning mass is on it. The engine has the relation —
`prFsWithMass(prMmd, prMadd, prCms)` (`packages/design/engine/formulas.ts:33`, exposed as
`Engine.prFsWithMass`, `packages/design/engine/Engine.ts:228`) — and `#prParams`
(`openisdDomain.ts:603`) already gathers exactly the three values it needs. No domain method
calls it, so the UI has nothing to read and the computed was left returning `null`.

## Fix

Add to `PassiveRadiatorBox`, beside `systemTuning_hz()`:

```ts
/** The radiator's OWN resonance with the tuning mass on its cone — WinISD's "Fs (with added
 *  mass)". Distinct from `systemTuning_hz()`, which is this radiator in this box. Null on the
 *  same terms: until a radiator is chosen and states its mass and compliance. */
resonanceWithAddedMass_hz(): number | null;
```

implemented in the `OpenISDBox` constructor's `this.passiveRadiator = {...}` block, reading
`radiator.spec.Mms_kg`, `radiator.spec.Cms_m_per_N` and `addedMass_kg` through the radiator's
own public surface and returning `engine.prFsWithMass(...)`. The physics stays in the engine;
the domain gathers the inputs; the UI reads one number.

Then `OriginalShell.vue:309` becomes a read of that method, and `PREditModal.vue` binds the
same one.

## Verification

- `packages/design/test/domain.test.ts`: a PR box whose radiator states Mms and Cms reports a
  resonance; adding mass lowers it; a box with no radiator chosen reports null.
- A browser test on the Original skin's Enclosure tab: set an added mass, assert
  `#og-pr-fs-mass` shows a number and that the number falls when the mass rises.
