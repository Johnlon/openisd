# BUG 20260916 — Signal pane: blank P with a phantom 1 W, and delete-V leaves P blank

Status: RESOLVED (re-verified 2026-09-26) — `NumInput` emits `blur-notify`; covered by `signal-pane-blur-must-notify.browser.spec.ts`.

## Symptom (reported by the human, two observed states)

1. On the Signal pane, a row shows **P = blank** while **V = 1.84 V**.
   The human correctly notes V can only be an OUTPUT: it is calculable solely from P and Re
   (`V = √(P·Re)`), so if P were truly unknown V cannot exist. A `1 W` must be hiding in the
   background but not displaying — indeed `1.844 ≈ √(1 · Re)` with Re ≈ 3.4 Ω, i.e. the value
   WinISD computes for **1 W into that driver's Re**.
2. **Deleting V** then leaving the cell clears and keeps P blank.

## Design ruling (from the human, asked directly: "is lose-focus a notification event?")

**YES — losing focus on a cell that was modified since entry must be a notification event.**
General rule, encoded for the whole editor, not just this pane:

> A **blur on a cell whose value changed since entry** must be surfaced as a notification
> (the parent — the drive-row binding — recomputes the derived sibling from the entered one).

Baseline numbers that define "the 1 W": with WinISD's reference power choice,
`V = √(P·Re)` gives `2.83 = √(1·8)` (1 W into 8 Ω) and `1.844 ≈ √(1·3.4)` (1 W into Re=3.4).
These are the same‑law members of one drive‑voltage/voltage‑drive group.

## Where the notification belongs (the three-layer answer)

| Layer | Knows | Role in the fix |
|---|---|---|
| **NumInput.vue** (component) | only that focus was lost; it does not hold the law | emit a **`blur-notify`** event when the cell was **modified since entry**. The component cannot and must not compute P from V — it has no Re. |
| **Domain / engine** (`solver.ts`, `formulas.ts`) | the law itself: `V=√(P·Re)`, `P=V²/Re` | **never sees blur**. Keep `deriveV`, `deriveP`, `deriveRe` on the pure pair-of-two API. No focus concept in the domain. |
| **Hook layer** (Signal-pane drive-row binding / its `useDriverDraft`-equivalent) | entered-vs-derived per cell, the law, Re | **consume the blur notification**: on `blur-notify` of a modified cell, re-derive the derived sibling from the two entered members and write it into the draft. |

So: the component owns "was it modified since entry"; the domain owns the math and stays
focus-free; the hook owns the re-derivation on notification. The domain must NOT learn about
focus — the human's instinct is correct.

## Root cause

`NumInput.vue`'s blur handler sets focus state and emits the field's value on blur; when the
result is a derived-only output (like V) it renders its *derived* value but the P row it
derives from is gated in a way that leaves P blank while V keeps a phantom value; and on the
delete-V path nothing re-commits P from `V²/Re` after blur. The fix is the notification event
above, owned at component+hook, law stays in domain.

## Acceptance (test-first)

- The Signal-pane P row displays a finite power whenever V and Re are entered
  (non-empty), and that power equals `V²/Re` to the editor's precision.
- Deleting V and blurring **recomputes** V from the still-present P and Re
  (`V = √(P·Re)`) — it never leaves both blank.
- No domain unit test mentions focus or blur.
- New UI spec fails before the fix (red) and passes after (green), run sequentially.

## Solution status
- [ ] Red spec committing the "P shows from V²/Re" + "delete-V recomputes from P·Re" assertions
- [ ] NumInput `blur-notify` (modified-since-entry) event
- [ ] Hook-layer consumption in the Signal-pane drive row
- [ ] Domain law unchanged, verified byte-identical via goldens
