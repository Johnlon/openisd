# BUG_20260824 — `AlignmentKind` names the wrong concept: it's box type, not alignment

Status: SUPERSEDED by the `packages/design` rebuild (2026-08-26) — not fixed in place, and
deliberately so. `packages/model` is being REPLACED by `packages/design`, not repaired, so
patching this defect in the old model would be work thrown away. The replacement does not carry
the defect: `packages/design`'s `BoxType` names the concept correctly from the start (`'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'passive-radiator' | 'abc'`), and no
`AlignmentKind` exists there at all.

It did carry it briefly: the first cut of `packages/design` named the six box-type interfaces
`SealedAlignment`/`VentedAlignment`/`Bandpass4Alignment`/… — the same defect, reintroduced in the
replacement while this record sat marked superseded. Caught by John on review, 2026-08-26, and
renamed to `SealedBox`/`VentedBox`/`Bandpass4Box`/…, with `box.ts` now stating the distinction
outright so the next person does not have to rediscover it. Worth noting as a pattern: a
defect being "superseded by a rewrite" is a claim about the rewrite, and needs checking against
the rewrite rather than assumed.

The record below is kept for its EVIDENCE, which is not superseded — it is the only account of
what those field shapes actually are, gathered by live probe. The distinction it draws — box TYPE (the topology) versus ALIGNMENT (the tuning/damping
curve, still unmodelled anywhere) — remains a real gap in the new model too.

## Symptom

`AlignmentKind` (`packages/model/src/openisdProject.ts:90`) is the type naming the four values
`'sealed' | 'vented' | 'bandpass4' | 'passive-radiator'`. In Thiele-Small loudspeaker-design
terminology, "alignment" names the specific tuning/damping curve chosen WITHIN a box topology
(e.g. a Butterworth vs. Chebyshev vs. QB3 alignment for a given sealed or vented box) — it is
narrower than, and a different axis from, which enclosure topology is in use.

What `AlignmentKind` actually enumerates — sealed vs. vented vs. bandpass vs. passive-radiator —
is topology, i.e. **box type**. The codebase already has the correct name for this concept
sitting right next to the wrong one: `WinIsdBType` (`openisdProject.ts:96-99`), WinISD's own
`.wpr` file field `[Box].BType`, is a raw numeric encoding of the exact same four-way choice.
`alignmentKindOfBType`/`bTypeOfAlignmentKind` (`openisdProject.ts`, near `WinIsdBType`) already
translate between the two vocabularies at one seam — meaning the codebase currently has TWO
names for one concept (box type), one of which (`AlignmentKind`) is also the name loudspeaker
literature uses for a genuinely different, currently-unmodelled concept (the tuning/damping
curve).

## Why it matters

- A future feature that actually needs "alignment" in the correct T-S sense (e.g. modelling
  Butterworth vs. Chebyshev sealed-box Q alignments) would have no correct name left to use —
  `AlignmentKind` would already be squatting on it for the wrong concept.
- Anyone reading this codebase with prior loudspeaker-design background will misread
  `AlignmentKind` as the tuning-curve concept and be surprised by what it actually holds.

## Scope of the fix

Not yet executed — pervasive rename. `AlignmentKind` and its accessors (`activeAlignment()`/
`setActiveAlignment()` on `OpenISDProject` and `ManagedOpenISDProject`, `toAlignmentKind`/
`fromAlignmentKind` translators, and every call site across `packages/model`, `packages/ui`
components, and test files) would move to `BoxType`-consistent naming, matching `WinIsdBType`'s
own vocabulary rather than colliding with it under a different name.

## Origin

Identified 2026-08-24, mid-conversation in `docs/design/ENCAPSULATION_AND_LAYERING.md`'s design
discussion, while re-deriving the project's composition from first principles. John: "indeed -
alignment is not box type - bug in terminology."
