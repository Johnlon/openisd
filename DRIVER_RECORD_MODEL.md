# Driver record model

**What openisd stores about a driver, and how a `.wdr` is produced from it.**

This is DESIGN — decisions we have made about our own files. It is not observation.
`WDR_SCHEMA.md` is the opposite: reverse-engineered facts about WinISD's format, which we do
not control. Where this document says a `.wdr` must be written a certain way, the reason is
always a fact recorded there, and it is cited.

## 1. The chain

Calculation happens in the MODEL. The files either side of it store different things, and the
difference is deliberate.

    driver.yml          ASSERTED values only — what a datasheet printed.
    openisd.yml         ASSERTED values only.
      |                 A derivable field nobody asserted is simply ABSENT from both. It is
      |                 not stored and not marked; there is nothing there to mark.
      |
      |  THE MODEL — loaded from either file, it computes the absent derivable fields on the
      |  fly, and every field then carries a C/E/N mark. This is what draws the charts.
      v
    .wdr                MUST carry the calculated values, not just the asserted ones.

`.wdr` is the exception because **WinISD does not recompute on open**
(`winisd_research/DISCOVERIES.md` BUG-005): a field written `0` with `C` displays as `0.00`
until the user edits something unrelated. So a `.wdr` missing its derived values is a file that
opens looking empty.

The `.yml` files have no such constraint — openisd computes on the fly — so they store only
what was asserted. A derived value persisted there would be a second copy of something a
formula already determines, free to drift from it.

**Two consequences to hold on to:**

- **Presence is the assertion.** A field in `openisd.yml` is there because someone stated it,
  so it reaches the `.wdr` as `E`. Absence is not a value and carries no mark.
- **`openisd.yml` → `.wdr` is NOT a serialisation.** It goes through the model, which supplies
  the derived values the file does not hold. That is also what keeps a single place where
  calculation occurs, so the two `.wdr` emitters — the export in `winisd_tools` and the browser
  export in `openisd` — cannot drift.

## 2. What `openisd.yml` carries per field: its SOURCE

Each asserted value records where it came from — a manufacturer datasheet, a product page,
whichever source supplied it. Editing that value in the app changes its source to **`manual`**,
and entering a value for a field that had none ADDS the field with source `manual`.

So the file needs no C/E/N flag. `E` is not stored, it is implied: a field is present because
someone asserted it, whatever the source. `C` and `N` describe fields the file does not carry
at all, and are decided by the model at the moment it writes a `.wdr`.

`manual` sits in the same vocabulary as the scraped sources (`winisd_tools`
`lib/record_registries.py` `source_rank()`), so a field's provenance stays answerable after a
human has touched it — which is the point: an edited value must never be mistaken for what the
manufacturer published.

## 3. Deciding each field's ParState character

**Two questions, in this order:**

1. **Is the field in the spec?** Present in `openisd.yml` → **`E`**, and the asserted value is
   written. Stop; the second question is never asked.
2. **It is absent, so: can the model calculate it?** Yes → **`C`**, and the computed value is
   written. No → **`N`**.

Question 1 asks the FILE; question 2 asks the MODEL. Neither asks the `.wdr`, and no C/E/N mark
is stored anywhere upstream — the character is derived at emit time from those two facts, so a
stored mark can never drift out of step with the data.

| in the spec | model can calculate it | `.wdr` gets                  | ParState | WinISD's behaviour on load                                                  |
| ----------- | ---------------------- | ---------------------------- | -------- | --------------------------------------------------------------------------- |
| yes         | not asked              | the asserted value           | `E`      | pinned. Changing its inputs has no effect, and no warning is issued         |
| no          | yes                    | the value the model computed | `C`      | recalculates live and instantly as inputs change; written correctly on save |
| no          | no                     | nothing                      | `N`      | same as `C` — recalculates live if it ever becomes derivable                |

Question 2 is only ever asked of a field the spec does not carry. For one it does, the value
was asserted, and `E` is the honest mark whether or not something could also have derived it.

**A datasheet value and a human's typed value are both `E`.** They differ in provenance, which
`openisd.yml` records as the field's source, but not in what they assert: someone stated this
number rather than deriving it. `.wdr` has no field for that distinction, so it does not travel.

The behaviour column is WinISD's, empirically verified — `WDR_SCHEMA.md` §5.1.

## 4. Inconsistency is MARKED, not resolved

Workspace ledger QP18, ruled 2026-08-05.

`E` pins a value, and a datasheet routinely prints a dependent field alongside its own inputs —
Qts with Qms and Qes — which at printed precision often do not reconcile. Writing all three `E`
pins a set WinISD will never question, because `WDR_SCHEMA.md` §5.1 records that it issues no
warning.

The ruling is that **which member is left to be derived does not matter**; what matters is that
the disagreement is visible. Every field in a group that has lost consistency carries a DQ mark,
judged against the fields' own precision rather than exact equality. The same mark covers an
over-determined group (ledger QO12) — where more members are asserted than the group needs, so
an asserted value is being ignored or is silently poisoning a derived one.

The groups themselves are WinISD's consistency-check groups, `WDR_SCHEMA.md` §4.

## 5. Xmax is never derived

`Xmax` is a measured physical limit — the excursion over which the motor stays linear. It is
the one member of `{Vd, Sd, Xmax}` that is not arithmetic, and openisd treats it as input only.

`Vd = Sd × Xmax` therefore runs in one direction here: `Vd` is computed when it is absent, and
never solved backwards to produce an `Xmax` nobody stated.

**Why, given WinISD does derive it** (`WDR_SCHEMA.md` §4.1):

- **It is circular.** Manufacturers normally publish `Vd` computed as `Sd × Xmax`. Deriving
  `Xmax` back out returns our own number as though it were independent corroboration, and a
  group that cannot disagree cannot be used as a check either.
- **It invents a limit.** A derived `Xmax` draws an excursion limit line on a chart. A limit
  the manufacturer never stated is not ours to assert, and a wrong limit line is worse than an
  absent one.
- **WinISD's own answer is not stable.** It has two routes with an undocumented precedence, so
  the same driver yields a different `Xmax` depending on which fields happen to be populated.

A driver whose datasheet omits `Xmax` simply has no `Xmax`. The excursion limit line is absent,
which is the honest rendering of "unknown".

**This is a deliberate divergence from WinISD** and the parity suite (ledger QO8) must expect
it: openisd will report no `Xmax` where WinISD synthesises one.
