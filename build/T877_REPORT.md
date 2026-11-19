# T877 report: several-driver wiring, slice 3 "Feature on"

Task T877 (the change that switches Driver wiring and "Impedance of one driver" on). Branch `t877`, pushed to remote `portingle`. ruling: QO946.
Not shipped, no PR (as briefed). A few existing tests are red on purpose and wait for a ruling: see section 4.

## 1. What was built
- Engine: a sweep with no `driverWiring` is now Parallel (the old "absent = one-driver chart, unscaled" path is gone). Sweep, max curves and the signal solve all go through `driverDrive`. New `SignalEngine.amplifierVoltageFor` (power to amplifier voltage), used by `ProjectSignal`, so the domain does no wiring arithmetic.
- Project: `OpenISDProject.driverWiring` and `winisdOneDriverImpedance` (from the held branch d8effe90, reused), both passed into `sweepParamsOf` (`SweepJobParams` now requires both) and into the signal solve (`driverWiring` and `rgAtDriverSide` in `projectResolve`). `driverWiringApplies` and `winisdOneDriverImpedanceApplies` (2 or more drivers). Every save writes both keys (`sessionOf`).
- `CompatSwitch.ONE_DRIVER_IMPEDANCE` (option, off by default, QO946.c131) and `ToggleField.ADV_WINISDONEDRIVERIMPEDANCE` with John's approved text, `WinisdOption.ONE_DRIVER_IMPEDANCE`, CLAUDE.md allowance line (rule kept).
- `EnumField.PROJECT_DRIVERWIRING` with John's approved text (after a title line), `DRIVER_WIRING_OPTIONS` (one list in packages/design).
- UI, both skins: `DriverWiring.vue` + `DriverWiring-hooks.ts` (desktop row under Num. of drivers, phone row under Drivers, drawn only with 2 or more drivers); Advanced switch "Impedance of one driver" in "Enable WinISD-style" on desktop and phone (greyed at 1 driver).
- Signal voltage help (Q1, QO946.c153): desktop help "Amplifier Output Voltage ... The voltage at your amplifier's output ..." and the phone Volts line "the voltage at your amplifier's output".

## 2. Tests added (red, then green)
| Test | Red first | Green |
|---|---|---|
| packages/design/test/domain/driver-wiring-feature-on.test.ts (12 tests: Series vs Parallel ratios, switch changes only zmag, signal power/voltage both ways, applies at 1/2/4 drivers, 4-1-4 keeps Series) | 6 of 7 failed (Series ignored: SPL 12.04 dB off, zmag x1), then 3 of 3 for the "applies" tests | 12 of 12 |
| packages/ui/test/hooks/DriverWiring-hooks.test.ts (3) | module missing | 3 of 3 |
| packages/design/test/domain/driver-wiring-data-facade.test.ts ("every save writes both keys", from the held branch plus this) | 1 failed (undefined, not 'parallel') | 14 of 14 |
| packages/ui/test/ui/driver-wiring.browser.spec.ts (8: both skins; row absent at 1, present at 4; Series makes the voltage 3.5 to 4 times higher at the same power; 4-1-4 keeps Series; voltage help; switch off, greyed at 1, editable at 4) | WRITTEN AFTER the code (no red shown) | 8 of 8 |

## 3. Existing tests and goldens changed
| File:line | Old -> new | Why |
|---|---|---|
| packages/design/test/domain/compat-switch.test.ts:16, 27-31, 59-62 | "three options" list -> four, adds 'Impedance of one driver'; "every option true" -> true except `ONE_DRIVER_IMPEDANCE` (false); a new test pins the exception | agreed feature (lead's list) |
| packages/design/test/domain/every-input-recalculates.test.ts (PROJECT_SETTINGS, COMPAT_SCENARIOS) | added `driverWiring: moves(...)`, `winisdOneDriverImpedance: compat`, scenario for the switch (2 drivers) | agreed feature (lead's list); nothing loosened |
| packages/design/test/domain/project/project-sweep-source.test.ts:15 | added `driverWiring`, `winisdOneDriverImpedance` to the source literal | the type now requires them; no assertion touched |
| packages/design/test/domain/driver-wiring-data.test.ts:40-41, 58-62, 67, 72 (slice 2's own test) | text injection `"nDrivers": 1, "driverWiring": ...` -> replace the key every save now writes (`"parallel"` -> `"series"`, `false` -> `true`, `"star"`); "file from before the keys" takes both keys OUT of the saved text first. Same assertions | "every save writes both keys" (lead's list). OUTSIDE the letter of the brief: please look |
| packages/ui/test/fixtures/branchMap/shared.ts | + 2 entries for DriverWiring.vue (branch map) | new component |
| packages/persistence/test/goldens/{backup-file/file-layout-6,many-projects/dump-layout-6,one-project/dump-layout-6,open-sessions/dump-layout-6}.json | project texts gain `driverWiring: "parallel"` and `winisdOneDriverImpedance: false` | every save writes both keys. PROOF: a script parsed old and new (every nested JSON text), removed those two keys and compared equal: True for all 4 files; 6+6+2+4 projects got exactly those keys |
| packages/design/test/fixtures/golden/sealed-2drv.json, vented-2drv.json (regenerated with `npm run gen-golden`) | only `sweep.zmag` changed, every value exactly x0.5 (1/N, N = 2); the 4 single-driver fixtures are byte-identical (git shows them unmodified) | the plan's multi-driver zmag. PROOF: leaf-by-leaf diff of old and new: differing paths = ['/sweep/zmag'] only; min/max ratio 0.5 / 0.5 |
| packages/ui/test/visual/...-snapshots (81 pictures, CI run 44170913499) | the project list line "5.7 KB" -> "5.8 KB" (the two saved keys). Checked desktop-dialog-crash old against new: that is the only visible difference. I did not open the other 80 | every save writes both keys |

## 4. Existing tests that are RED and that I did NOT change (needs the lead / John)
Evidence: a copy of each file with the minimal edit was run (scratch copies, since deleted).
| Test | Fails because | What I proved |
|---|---|---|
| design/test/engine/driver-wiring-goldens.test.ts:44-60 (4 tests "absent driverWiring is today's path ... equals the absent-field sweep") | the absent path is removed (the brief): an absent field is now Parallel and the chart is the amplifier's load | they pinned the inert slice; needs rewriting as "absent = Parallel/unticked" |
| design/test/domain/severalDriversImpedance.test.ts:41, 51, 67 (3) | assert one driver's impedance at any count | with `winisdOneDriverImpedance.set(true)` in `four()` all 3 pass (scratch copy run) |
| design/test/domain/project-signal.test.ts:245, 255, 276 (3) | the default project has Rg 0.1 ohm AT THE AMPLIFIER (`openisdTransforms.ts:193` rgAtDriverSide false): Parallel gives each of 4 drivers 4 x 0.1 ohm; V each sqrt(6.4/4) = 1.265 not sqrt(6.1/4) = 1.235 | probably pass with `rgAtDriverSide.set(true)` in those tests (NOT run; the arithmetic is the old formula) |
| design/test/engine/driver-count-winisd.test.ts (24: the WinISD two-driver captures, Rg 0.1 at the amplifier) | with the switch ticked the 5 impedance checks pass, but 19 SPL/excursion/TF/max-power checks fail: WinISD gives each driver Rg, the circuit gives N x Rg (plan 5.3, "no switch restores it"). With Rg at the driver instead, SPL passes and the 5 impedance checks fail (the chart then holds Rg) | no one setting reproduces these captures any more: needs John's ruling (plan 5.3 says accepted) |
| ui/test/ui/original-advanced-tab.browser.spec.ts:327 and :487 (4 tests) | the list of switch labels and `toHaveCount(11)` lack the new switch | add the label, 12 |
| design/test/fields/desktopHelp.test.ts ("Placement and Signal source...") and phoneText.test.ts ("the Driver tab has one User options band ...") would fail if the Driver wiring row is added to the ? help sheets | they pin the exact row lists | so I did NOT add Driver wiring to the ? sheets: only its hover text exists (registry). Needs the two list lines changed |

## 5. Gates
- Architecture (`unit-architecture.sh`): 266 of 266 pass. Typecheck and lint pass.
- `unit-changed.sh` and design/persistence/ui-hook unit runs: the only failures are the ones in section 4.
- Browser specs run (`bash scripts/test.sh`, LD_LIBRARY_PATH set): field-layout-rules, mobile-driver-tab, mobile-advanced-tab, original-signal-tab, original-advanced-tab, my-wiring, wiring-dq-mark, phone-driver-tab-stable-columns, original-winisd-differences, mobile-signal-tab, joined-field: 178 passed, 4 failed (the original-advanced-tab ones above). driver-wiring.browser.spec.ts: 8 of 8.
- field-layout-rules gate: passes, but it opens the Driver tab at 1 driver, so the new row is NOT checked by it. The 4-driver pictures show no clipping on either skin (desktop 1280x720, phone 390x844); I did not run the gate at 374x705 with 4 drivers.
- CI picture re-take: run 44170913499 (success), 81 screens changed (section 3).

## 6. Pictures (/tmp/claude-1000/-home-johnl-work-winisd/fc0cdd2c-c7c9-4e94-a7d4-2d5b19a8b1e9/scratchpad/wiring3/)
Project: 4 x Dayton DA215-8, sealed 160 L, 2.83 V typed, Rg 0. Before = portingle/main (f2f0e10b) in a worktree with its own npm ci. After = this branch. Every picture has a red box and a red banner saying what to look at. Desktop 1280x720, phone 390x844. Names: `<before|after>-<letter>-<skin>-...png`.
- a: Driver tab, 4 drivers, `after-a-<skin>-driver-tab-parallel` and `-series` (the new Driver wiring row); `before-a-...` has no row.
- b: SPL chart: `bc-<skin>-charts-parallel` 100.792 dB at 1 kHz, `-series` 88.751 dB: 12.041 dB apart (read from the Data table, in the banner). `before-bc-...` is 100.792 in every state.
- c: Impedance chart, same pictures: Parallel 1.708 ohm at 1 kHz, Series 27.321, `-series-ticked` and `-parallel-ticked` 6.830 (one driver). Before: 6.830 always.
- d: `d-<skin>-advanced-switch` (the switch, ticked) and `d-<skin>-advanced-switch-help` (the "?" popup holding its help: desktop "OpenISD and WinISD differences" entry, phone short line).
- e: `e-<skin>-1driver-driver-tab`: no Driver wiring row.
Check made: before and after Parallel SPL are equal (100.792), as the plan says.

## 7. Plan errors found (docs/plans/PLAN_20261116_DRIVER_WIRING.md)
1. Lines 71-75 (section 2 "Consequence"), 280 ("Either wiring, Rg at driver (the default)") and 311 ("Rg at driver side (default)"): the default placement is Rg at the AMPLIFIER (`rgAtDriverSide: false`, `openisdTransforms.ts:193`) with Rg 0.1 ohm. So an existing multi-driver project does NOT keep every SPL: 4 drivers at the default lose 20 log10(6.9/7.2) = -0.37 dB (measured: 100.299 dB at Rg 0.1 against 100.792 at Rg 0).
2. Lines 62, 320, 345: Series is 12.041 dB below Parallel only at Rg 0; at the default Rg 0.1 I measured 11.58 dB (100.299 against 88.719).
3. Line 343 ("equal to PR 138's goldens byte for byte") holds at Rg 0 or Rg at the driver only; the WinISD capture tests at Rg 0.1 at the amplifier cannot be matched (section 4).
4. Line 266-269 says PR 3 "always passes the field and removes that path": that makes the 4 inert-slice golden tests (section 4) wrong by design; the plan does not list them.

## 8. What is left
- Rulings/edits for section 4 (the red tests), the two ? help row lists, and John's approval of the phone short line for the switch (new text, not approved).
- The Driver wiring row in the ? help sheets (blocked by the two list tests).
- Layout gate and stable-columns specs at 2+ drivers; a visual baseline screen for the 4-driver Driver tab.
- `ship.sh` has not been run; the red tests block it.

## 9. Round 2 (lead decision QO946.c234): results
Commit 3555d7af (pushed to `t877`). Changed existing-test lines, old -> new:
| File:line | Old -> new |
|---|---|
| design/test/engine/driver-wiring-goldens.test.ts:44-53 (4 tests) | describe "absent driverWiring is today's path: ..." -> "a sweep with no wiring stated is exactly the Parallel result"; each test compared the Parallel+switch-ticked sweep with the no-wiring sweep -> compares the no-wiring sweep with `on(base,'parallel',false)`, `toEqual` byte for byte, sealed and vented, Rg 0 and Rg 0.5 at each driver (26 of 26 pass). Header comment line 6-7 reworded. The maxCurves test (line 56) is unchanged and passes |
| design/test/domain/severalDriversImpedance.test.ts:30-34 (`four()`, so tests at :41, :51, :67) | `p.nDrivers.set(4); return p;` -> also `p.winisdOneDriverImpedance.set(true);` (5 of 5 pass). Nothing else |
| ui/test/ui/original-advanced-tab.browser.spec.ts:327 | label list gains `/Impedance of one driver/` after the ABC one |
| ui/test/ui/original-advanced-tab.browser.spec.ts:487 | `toHaveCount(11)` -> `toHaveCount(12)` |
| design/test/fields/desktopHelp.test.ts:17 | `[NUM_DRIVERS, 'Coil wiring']` -> `[NUM_DRIVERS, 'Driver wiring', 'Coil wiring']` |
| design/test/fields/phoneText.test.ts:111 | `['Select driver','Edit','Drivers','Coil wiring']` -> `[..., 'Drivers','Driver wiring','Coil wiring']` |
New: design/test/fields/coil-wiring-help.test.ts, a test that both ? sheets carry the approved registry text word for word (the first letter lower-cased as the phone rows do). New rows: `PhoneHelpRows.DRIVER_WIRING`, in the phone User options help and the desktop Placement help.
New gate cases in ui/test/ui/field-layout-rules.browser.spec.ts (EXTRA): "desktop Driver tab with 4 drivers" (1280x720) and "phone Driver tab with 4 drivers" (374x705), both pass rules 2 to 7.
Browser specs run after this round: field-layout-rules (the whole file, so the 4-driver cases included), phone-driver-tab-stable-columns, original-advanced-tab, driver-wiring, mobile-advanced-tab, original-winisd-differences: 130 passed, 0 failed. Typecheck, lint, architecture (266 of 266) pass.
Picture re-take, run 44176317776: "no picture changed" (no commit needed).
Still RED, waiting for John's ruling on amplifier Rg (untouched as ordered): design/test/engine/driver-count-winisd.test.ts (24 tests) and design/test/domain/project-signal.test.ts:245, 255, 276 (3 tests). `unit-changed.sh` shows no other failure.
Sections 4 and 8 above are superseded by this list for everything except those two files and John's approval of the phone short line for the switch.
