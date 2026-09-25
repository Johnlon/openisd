# B5 — calculated values in records: RULED, no marker

Ruling: QT56 + refinements (winisd_tools `questions.yml`, verbatim, 2026-08-21).

## The design

1. **No calculated-marker field.** Records never carry a pipeline-computed `read_value`, so
   nothing needs labelling.
2. **`read_value`/`read_precision` are optional**, null licensed only by
   `rejected: no-numeric-value` (landed: QT48/B2, `model_driver.py`). The producers emit such
   a reading for a numberless printed literal ("N/A", "TBD", …), preserving the literal
   verbatim in `actual_reading`
   (`bugs/BUG_20260821_producers_cannot_emit_the_optional_read_value_the_model_now_allows.md`).
3. **openisd treats a null `read_value` as N** (`Provenance.NotAvailable`), never Entered.
   Lands with the B10 read-side work.
4. **Python keeps calculating DQs for now** (relation-math deletion deferred) **but never
   populates `read_value` from a calculation.** A model gate makes a computed reading
   unrepresentable: a `Reading`'s numeric fields must derive from its own printed literal.
5. `.wdr` projection may still compute values (Dd from Sd, …) — those land only in `.wdr`
   artifacts, never in records.

## Supporting analysis

DQ responsibilities inventory: `DQ_SPLIT_QT56_INVENTORY.md`.
