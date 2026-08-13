# OpenISD — User Interface & Charting Specification (`SPEC_UI.md`)

This specification defines the user interface presentation requirements, chart mapping contracts, and state behavior implemented by `@openisd/ui` (`packages/ui/src/`).

---

## 1. Chart Presentation & Series Mapping

### 1.1 Decoupled Chart Series Building

- **Decoupling Rule**: `packages/ui/src/logic/series.ts` is strictly a presentation adapter. It performs NO electro-acoustic calculations or baseline subtraction math. It receives pre-computed data arrays (`sw.tfMag`, `sw.spl`, `sw.exc`, `sw.gd`) from `@openisd/engine` and formats them into renderer series (`Series[]`).
- **Transfer Function Magnitude Chart**:
  - Primary series: `sw.tfMag` from engine (0 dB = high-frequency passband asymptote).
  - Reference lines: $0\text{ dB}$ (dashed grey) and $-3\text{ dB}$ (dashed orange).

**Verifying Tests**:

- [`packages/ui/test/ui/chart-types.test.ts`](../../packages/ui/test/ui/chart-types.test.ts)

---

## 2. Driver Editor & Parameter State Cascade

### 2.1 E/C/N State Color Marks

- **Entered (E)**: Value entered by the user (green mark).
- **Calculated (C)**: Value derived by the consistency solver (blue mark).
- **Not specified (N)**: Value unentered / uncalculated (black mark).

**Verifying Tests**:

- [`packages/ui/test/ui/driver-type-chips.test.ts`](../../packages/ui/test/ui/driver-type-chips.test.ts)
- [`packages/ui/test/logic/driver-editor-solver.browser.spec.ts`](../../packages/ui/test/logic/driver-editor-solver.browser.spec.ts)

---

## 3. Data Shapes — Chart Input & Filter Chain

### 3.1 `SweepResult` fields consumed by charts

`series.ts` reads pre-computed arrays off `SweepResult` (`@openisd/engine`) — see
[`SPEC_ENGINE.md` §4.3](SPEC_ENGINE.md#43-sweep-parameters--sweepdrv-driver-box-boxtype-p-sweepparams--sweepresult)
for the full field list and units. The three EQ/Filter-chain charts
(`FltMag`/`FltPhase`/`FltGD`, `types.ts` `ChartTabId`) map directly to `fltMag`/`fltPhase`/
`fltGd` — these depend only on `SweepParams.filters` and the frequency grid, never on the
driver or box.

### 3.2 Filter chain — `Filter[]` (`SweepParams.filters`)

```ts
type FilterType = 'highpass' | 'lowpass' | 'linkwitz' | 'peaking' | 'lowshelf' | 'highshelf';

interface Filter {
  id?: string;       // UI list key only — ignored by the engine
  type: FilterType;
  enabled: boolean;  // disabled filters are skipped by applyFilters()
  fc?: number; Q?: number;             // highpass / lowpass / peaking / lowshelf / highshelf
  f0?: number; Q0?: number;            // linkwitz — source pole
  fp?: number; Qp?: number;            // linkwitz — target pole
  gain?: number;                       // peaking / lowshelf / highshelf, dB
}
```

| `type` | Reads | Description |
|---|---|---|
| `'highpass'` | `fc`, `Q` (optional, default 1/√2) | Butterworth high-pass |
| `'lowpass'` | `fc`, `Q` (optional, default 1/√2) | Butterworth low-pass |
| `'linkwitz'` | `f0`, `Q0`, `fp`, `Qp` | Linkwitz transform — remaps a `Q0`-at-`f0` response to `Qp`-at-`fp` |
| `'peaking'` | `fc`, `Q`, `gain` | Peaking EQ |
| `'lowshelf'` | `fc`, `Q` (optional, default 1/√2), `gain` | Low-shelf EQ |
| `'highshelf'` | `fc`, `Q` (optional, default 1/√2), `gain` | High-shelf EQ |

0 dB is defined at the driver terminal (WinISD Pro help, "Filter/equalizer behavioral
simulator": *"0 dB gain at filter chain means that voltage at driver terminal is equal that
is specified at 'signal'-tab"*) — a filter chain with every entry disabled is unity gain.

**Verifying Tests**:

- [`packages/engine/test/sweep.test.ts`](../../packages/engine/test/sweep.test.ts)
- [`packages/ui/test/ui/chart-types.test.ts`](../../packages/ui/test/ui/chart-types.test.ts)

---

## 4. Presentation rules (`UI-n`)

`UI-n` are **stable identifiers** cited from source comments and from the path-scoped rule
`claude/rules/openisd-ui-design.md`. Never renumber one.

Only the **Original** skin is a target for these rules — Classic and Modern are unmaintained
(`AGENTS.md`).

### UI-1: Every button and interactive control must have a tooltip

**Rule:** Every `<button>` and every nav-like interactive element (toggle chips, icon-only
controls, collapsible section headers) MUST carry a `title` attribute. No exceptions.

**Rationale:**

- Users discover features by hovering. A button with no tooltip is a black box — ignored
  entirely, or clicked by accident without understanding the effect.
- Abbreviated labels (`+ HP`, `2.83V`, `▸`) are ambiguous on their own.
- Screen readers fall back on `title` when no `aria-label` is set.

**Format:**

- Describe the *effect*, not the label: `"Set to 2.83V — IEC 60268-5 sensitivity standard"`, not
  `"2.83V button"`.
- Collapsible sections: `"Expand [section] — [one-line summary of what's inside]"`.
- Destructive or irreversible actions: state the consequence, e.g. `"Remove this filter from the
  chain"`.

**Enforcement:** convention and review only — no automated gate asserts a `title` on every
button, and no test enumerates them.

### UI-2: Box panel layout must be symmetric across all box types

**Rule:** Controls that apply to every box type (Type selector, Vb, box losses) occupy fixed
positions shared by all box types. Box-type-specific controls (vent diameter/length, PR
parameters, bandpass front chamber) go in a conditional block in the middle. Every box type
shares one structural skeleton:

```
[Type selector]
[Vb]
[Box losses toggle]   ← always here, applies to all types
── box-specific block (conditional) ──
[Alignment / tune buttons]
```

**Rationale:**

- Users switch box types to compare results. A control that looks like it belongs to one box type
  is confusing when it moves or disappears on switching.
- Consistent placement means the user knows where box losses are regardless of box type.
- An asymmetric layout implies — wrongly — that a feature does not apply to some box types.

### UI-3: Docs, tooltips, values and refs cross-reference WinISD wherever one exists

**Rule:** Every tooltip, label, default value, doc section and parameter description states its
WinISD equivalent where there is one:

- the name WinISD uses for the parameter;
- WinISD's default value, if it has one;
- where it appears in the WinISD UI (which tab, popup, or field);
- any known behavioural or convention difference between OpenISD and WinISD.

**Rationale:** OpenISD's primary audience is WinISD users migrating or cross-checking, arriving
with WinISD mental models. Without the mapping they hunt for familiar controls, or doubt whether
the results are comparable. WinISD is the canonical compatibility reference.

**Examples:**

- `"Leakage loss. WinISD default: Ql=10. Found in Box tab → Advanced → popup."`
- `"Drive voltage. Called 'Driver input voltage (each)' in WinISD."`
- `// Ql=10, Qa=100 — WinISD 0.7.0.950 defaults`
- Heading: `"Box losses (WinISD: Advanced → Ql / Qa)"`

Evidence for a parity claim belongs in
[`../research/WINISD_PARITY.md`](../research/WINISD_PARITY.md), not inline.

### UI-4: Intrinsic parameters are collapsible; tunable parameters are always visible

**Rule:** Two classes of parameter, treated differently in every panel:

- **Intrinsic** — datasheet specs describing what a component *is* (PR: Sd, Mms, Cms, Rms, Xmax,
  Fs; Driver: Fs, Qts, Vas, Re, Le, Xmax). These live inside a collapsible edit section, hidden
  by default. Rarely changed after initial setup.
- **Tunable** — values actively adjusted during a design session (PR: added mass; Box: Vb, vent
  length, vent diameter, box losses). These stay permanently visible, outside any collapsible
  block, so they can be tweaked without entering edit mode.

**Structural pattern (PR panel):**

```
[Browse PR library]                    ← always visible
[PR name] [Edit ✎]                     ← always visible (summary)
[Sd · Fs · Qms · Xmax]                 ← always visible (summary specs)
── edit section (collapsed by default) ──
  [PR name, Sd, Xmax, Mms, Cms, Rms, Fs, Qms, Vas inputs]
  [Save]
── end edit section ──
[PR tuning] subsection                 ← always visible
[Added mass _______ g]                 ← always visible (tunable)
[Total Mms / Fp / Fs+mass readouts]    ← always visible
```

**Rationale:**

- Users iterate on tunable parameters (adjusting added mass to shift Fp) but rarely re-enter
  intrinsic specs.
- Hiding a tunable control inside an edit section forces a needless modal interaction and hides
  the primary feedback loop.
- Keeping intrinsic specs collapsible reduces panel height once a component is configured.
