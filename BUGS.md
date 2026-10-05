# Known bugs

Every record in [`bugs/`](bugs/) is listed below. Resolved, closed and obsolete records are in
[`bugs/archive/`](bugs/archive/) (`scripts/archive-bugs.py` moves them). Rebuilt 2026-10-05.

## Open

| Behaviour                                                                                   | Record                                                                                                                                                                                                            |
|---------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| WinISD crashes capturing the `solve-from-mms-cms` parity scenario; no golden exists for it. | [winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured](bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md) |
| `drivers/mysamples/winisd/s-roo.wdr` contradicts the researched c-from-Roo recompute rule.  | [s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule](bugs/BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md)                                                                     |
| `.wdr` round-trip test cycles each file once; no second-generation fixed-point check.       | [wdr_round_trip_test_has_no_second_generation_fixed_point_check](bugs/BUG_20260907_wdr_round_trip_test_has_no_second_generation_fixed_point_check.md)                                                             |
| Bandpass6 and ABC group delay differ from WinISD's while the phase matches.                 | [bp6-abc-group-delay-not-winisd](bugs/BUG_20260929_bp6-abc-group-delay-not-winisd.md)                                                                                                                             |
| A refresh marks unsaved edits as saved; Revert loses them. Waits on John's ruling.           | [boot-commits-unsaved-edits-unsaved-mark-lost-on-refresh](bugs/BUG_20261001_boot-commits-unsaved-edits-unsaved-mark-lost-on-refresh.md)                                                                           |
| WinISD bug, not copied: WinISD ignores an Sd edit on a passive radiator.                    | [winisd-pr-sd-edit-ignored](bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md)                                                                                                                                       |
| WinISD bug, not copied: emptying a passive radiator's Vas box crashes WinISD.               | [winisd-pr-vas-box-emptied-crashes](bugs/BUG_20261004_winisd-pr-vas-box-emptied-crashes.md)                                                                                                                       |
