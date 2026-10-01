# Usability panel report — simulated persona panel over the real UI

**Date:** 2026-10-01 · **What this is (and is not):** a panel of four simulated user
personas, each walking the app's *actual* flows (wizard, Options dialog, charts, driver
editor) as they exist in the current source and Playwright-run UI. No real humans were
involved; every finding is grounded in a named UI surface or one of today's recorded bugs.
Findings that only real users can settle (delight, wording taste, discoverability in the
wild) are marked ⚠ needs-human.

---

## The panel

| Persona | Profile | What they came to do |
|---|---|---|
| **P1 — First-time hobbyist** | Building a first subwoofer. Knows litres and watts; does not know Thiele–Small parameters. | New-project wizard end to end; understand what the warnings mean. |
| **P2 — WinISD veteran** | 15 years of WinISD muscle memory; migrating because WinISD is abandoned. | Reproduce a known WinISD project; find every WinISD option they rely on. |
| **P3 — Power user / designer** | Designs boxes weekly; wants speed, precision, keyboard flow, batch iteration. | Tune a vented design against limits; iterate alignments fast. |
| **P4 — Clarity & accessibility reviewer** | Low vision; keyboard-first; screen-reader tolerant. | Complete the same flows without the mouse, read every readout. |

---

## P1 — First-time hobbyist

| # | Finding | Severity | Grounding |
|---|---|---|---|
| P1-1 | The wizard is genuinely good for a beginner: driver → count → box type → alignment → name, with EBP and a plain-language recommendation ("Sealed preferred") at step 3/4. | strength | `OriginalNewProject.vue` readout box |
| P1-2 | **Warning text is written for the authors, not the user.** An implausible design shows: "Box volume is 1684 L, outside the plausible 1 L - 1000 L band set in Settings. *WinISD gives the same answer, and OpenISD keeps it rather than quietly changing it.*" A beginner does not know what WinISD is or why it is being invoked. The sentence they need — "this box is probably too big to be a real design; check your driver's Qts" — is absent. | **HIGH** | `issueText.ts` `PARITY`; `plausibility.ts` |
| P1-3 | "Settings" in the warning is not a link or pointer; on mobile there is no obvious path from wizard → Options. | MEDIUM | warning text; Options lives in the shell toolbar |
| P1-4 | Default alignment C4 at a mid driver can produce a 1684 L box with no explanation that *this alignment choice* is the cause; a beginner will think the app is broken (BUG 3's parity sentence makes it worse, not better). | MEDIUM | C4 capture table, Qts 1.0 row |
| P1-5 | Driver preview on step 1 shows only Fs/Qts/Vas; a beginner cannot tell whether their driver data is complete enough to design from. | LOW | `selectedDriverSpecs` |

**Top improvement:** rewrite the warning suffix (BUG 3's fix is the enabler) into two
sentences: what is wrong, and what to do ("Pick a different alignment, or widen the band in
Settings → Vented design limits").

## P2 — WinISD veteran

| # | Finding | Severity | Grounding |
|---|---|---|---|
| P2-1 | Parity is the killer feature and it holds: five alignments, WinISD dropdown order, bit-exact designs. The "More info" popup in Settings explains the no-clamp philosophy honestly. | strength | `VENTED_ALIGNMENT_OPTIONS`; Options popup |
| P2-2 | **Chart Y-limits table is broken in exactly the way a veteran will trigger it** — they will set one of Start/End (WinISD's dialog applies both with its shown defaults), click OK, and the chart ignores them silently (BUG 1). For the migrating user this reads as "OpenISD is less capable than WinISD", the one impression this project cannot afford. | **HIGH** | BUG 1 |
| P2-3 | Frequency-range Start/End in the same dialog can be saved broken (cleared / inverted), which a veteran will hit by clearing a field first (BUG 2). WinISD validates; we must too. | **HIGH** | BUG 2 |
| P2-4 | The disabled "0 dB line"/"-3 dB line" color rows are explained in tooltips (honest), and the mapping of WinISD's "EQ transfer func mag" → FltMag is correct. | strength | `LIMIT_ROWS` comment history |
| P2-5 | Wizard dropdown order matches WinISD exactly (QB3, BB4, C4, EBS3, EBS6) while the binary enum differs — a parity trap avoided; worth a note in docs for future maintainers. | LOW | alignment doc §1 |

**Top improvement:** fix BUGS 1–2 before any migration-oriented messaging; they sit on the
exact surface (Options → Plot Window) a WinISD user visits first.

## P3 — Power user / designer

| # | Finding | Severity | Grounding |
|---|---|---|---|
| P3-1 | Alignment iteration is fast: select → readout updates live; warnings re-judge per alignment. | strength | hook computeds |
| P3-2 | **One invalid band field disables saving the entire dialog** — chart colors, username, plot-window edits in other tabs are all lost if, say, min tuning ≥ max. There is no per-fieldset error scoping, and Cancel vs OK is not distinguished in the error message. | MEDIUM | `canApply` gates `saveAndClose` wholly |
| P3-3 | No way to reset the band from the wizard when a design trips it: the trip is informative but the remedy (Options → Settings tab → Reset) is 4 clicks + a modal round-trip per iteration. | MEDIUM | dialog structure |
| P3-4 | Warning numbers format well (litres/Hz, one decimal in the readout; 2-sig-fig for tiny values in text) — but tiny volumes render exponent-form ("2.7e-6 L") in the warning sentence, unusual for the audience. | LOW | `issueText.decimal` |
| P3-5 | Keyboard: the dialog supports Esc; number inputs are native; the wizard's selects are native — usable, but no documented shortcuts for Next/Back on the wizard. ⚠ needs-human (real keyboard-flow testing). | LOW | `useEscToClose` |

**Top improvement:** scope the dialog's validity to each fieldset (or apply what is valid
and report what was not), so one bad field never destroys unrelated edits (P3-2), and put a
"Reset to defaults" affordance directly in the warning (P3-3).

## P4 — Clarity & accessibility reviewer

| # | Finding | Severity | Grounding |
|---|---|---|---|
| P4-1 | The step-4 warning is plain text in a `readout-warning` element with no `role="alert"`/`aria-live` — a screen-reader user completing step 4 hears the volume but not the warning. | **HIGH** | `OriginalNewProject.vue:216-218` |
| P4-2 | The Options "More info" popup is a `role="note"` with `aria-expanded` on the toggle — good pattern, worth copying elsewhere. | strength | `limits-more` markup |
| P4-3 | Readouts mix value + unit in one `<strong>`; screen readers read "17.3 l" fine, but the label/value pairing is span+strong without a definition-list or `aria-label` — tolerable, not ideal. ⚠ needs-human (real SR pass). | LOW | readout markup |
| P4-4 | The disabled color swatches keep labels but no `aria-disabled` explanation beyond the title attribute; titles are not announced by all SRs. | LOW | Options colors |
| P4-5 | Error text in the dialog is colour-coded (`.opt-error`) but not associated with any input via `aria-describedby`. | MEDIUM | Options error div |

**Top improvement:** `aria-live="polite"` on the wizard warning containers (P4-1) — one
attribute, closes the loudest gap.

---

## Priorities (across panel)

| Priority | Item | Type |
|---|---|---|
| **P0** | BUG 1 — Options chart Y-limits silently ignored (partial edit / inverted) | bug, recorded |
| **P0** | BUG 2 — frequency range savable empty/inverted, persists across reload | bug, recorded |
| **P1** | P4-1 — wizard warnings not announced to screen readers | a11y, one attribute |
| **P1** | BUG 3 + P1-2 — rewrite the plausibility sentence for users (drop/replace unevidenced WinISD claim, add remedy) | bug + UX, same fix |
| **P2** | P3-2 — per-fieldset validity in the Options dialog | UX |
| **P2** | P3-3 — remedy affordance in the wizard warning | UX |
| **P2** | Plan item 3 — single-source wizard Ql (drift risk behind INV-5) | engineering hygiene |
| **P3** | P4-5, P4-4 — error aria wiring, disabled-swatch semantics | a11y polish |
| **P3** | P3-4 — exponent-form litres in warning text | polish |
| **P3** | ⚠ needs-human batch — real keyboard flow, real SR pass, wording taste | requires people |

## Recommended order of execution

1. Fix BUGS 1–2 (P0) — same file, same test file, one session.
2. BUG 3 / P1-2 sentence rewrite (P1) — `plausibility.ts` + wizard warning copy, together.
3. P4-1 aria-live (P1) — one line in each wizard shell (original + mobile).
4. P3-2/P3-3 dialog scoping (P2) — needs a small hook refactor of `error`/`canApply`.
5. Then run a real human session (the ⚠ rows) with this report as the interview script.
