# PLAN 2026-10-07: finish 6th-order bandpass and ABC

Bugs: [volumes show 0](../../bugs/BUG_20261007_bp6-abc-box-volumes-show-zero.md), [Ffc edits the vented box](../../bugs/BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box.md).
Losses popup is done (`BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md`, resolved).
Already fine: engine circuits (`bandpass6-winisd.test.ts`, `abc-winisd.test.ts`), chart lists, .wpr import/export of Vr/Vf/Fr/Ff/vents (`winIsdProjectConverter.ts`), .owpr schema, loss rows.
Captured from WinISD 2026-10-07 (W5-1138SMF, run `winisd_research/runs/bp6_abc_wizard_defaults/`, winisd_research commit f439b3b; observed in the saved `.wpr` `bp6_project.wpr` / `abc_project.wpr` and the Box/Vents tab screenshots `bp6_tab_Box.png`, `bp6_tab_Vents.png`, `abc_tab_Box.png`, `abc_tab_Vents.png`):

| Item | 6th-order bandpass | ABC |
|---|---|---|
| Wizard pages | driver, count/wiring, box type, alignment (`<None available>`), project name; same for both, no volume or tuning page (`bp6_wiz01..07`, `abc_wiz01..07`) | same |
| Vr / Fr (rear) | 0.03 m3 / 35 Hz | 0.03 m3 / 35 Hz |
| Vf / Ff (front) | 0.02 m3 / 25 Hz | 0.02 m3 / 25 Hz |
| Intra chamber (Vc, Fc) | none (Vc=0, Fc=0) | Vc=0, Fc=0 in `[Box]`; no volume field on the Box tab |
| Rear vent | 1 round, dia 0.102 m, len 0.5906 m, end corr 0.732, Fb 35 | same |
| Front vent | 1 round, dia 0.102 m, len 1.8812 m, end corr 0.732, Fb 25 | same |
| Intra vent | no `[VentIntra]` | 1 round, dia 0.102 m, len 0.050 m (editable), end corr 0.732, Fb 14.004, Vb 1 |
| Vents tab layout | two columns Rear, Front: Number, Shape, Vent diameter, Vent length (greyed), End Correction, Cross area (greyed), 1st port resonance (greyed) | three columns Rear, Front, Intra; Intra length is editable |
| Losses (`[Box]`) | Qlr 10, Qar 100, Qpr 100; Qlf 10, Qaf 100, Qpf 100; Qiclfr 100; Qlc/Qac/Qpc 0; Qiclfc 0, Qiclcr 0 | same |

Not captured: the Advanced-> popup screenshots on the wizard-made projects (the Q values above come from the `.wpr`); the 1.5x Xvfb scale leaves a black rectangle over the graph in the full-window screenshots.

| # | Step | Files | Failing test first (lowest layer) | Capture first? | Needs |
|---|---|---|---|---|---|
| 0 | Capture WinISD new-project defaults for 6th and ABC: Vr, Vf, Fr, Ff, vent dia/length/count/shape for all 2-3 vents, wizard pages and fields | `winisd_research` (new run) | none | DONE (see above) | none |
| 1 | Starting values: `applyStartingValues` fills bp6 and ABC volumes, tunings and vent geometry; builder keeps `?? 0` only for an explicit blank | `openISDBox.ts:486`, `openisdTransforms.ts:356`, `boxDefaults.ts` | design spec: built bp6/ABC project has Vr, Vf > 0, Fr, Ff stated, vent sized, `sweepPlan` ready (plus correct `project-sweep-plan.test.ts:54` and `project-sweep.test.ts:82` which assume blocked/null) | YES (0) | DONE 2026-10-07: volumes, tunings, vent diameters and the ABC intra length are stated at build (`bandpass6-abc-starting-values.test.ts`); a new bandpass6 sweeps (`project-sweep.test.ts`); the vent lengths wait for step 2 | 0 |
| 2 | Vent solve for bp6/ABC: resolve runs the tuning/length solve for rear, front (and intra length) so entering tuning gives a length and the reverse | `projectResolve.ts:~108-150`, `projectSweep.ts` guards | design spec: set Fr, Ff, get vent lengths; set length, get tuning; unreachable target marks the vent | no | DONE 2026-10-07: rear/front tuning and length are pairs; lengths come out at WinISD's 0.5906 m / 1.8812 m; the new-project vents use end correction 0.732 (`bandpass6-abc-starting-values.test.ts`) | 1 |
| 3 | `ventGroupOf` for bp6/ABC returns front chamber's cells; add `rearVentGroupOf` for the rear | `openISDBox.ts:391`, `box.ts`, `ventGroup.ts`, `whatIfSession.ts:44,61` | design spec: group tuning cell is the chamber's own, not `vented`'s (bug 2) | no | none |
| 4 | Vent hooks: rear/front/intra vent readouts and fields (diameter, shape, count, length, tuning, end correction) | `ventReadouts.ts`, `boxFields.ts`, `OriginalShell-hooks.ts`, `MobileEnclosureTab-hooks.ts` | hooks spec: per box type, the active vents are those of the chamber/port asked for | no | 3 |
| 5 | Desktop Vents pane: replace static "8.00/9.00/6.00" disabled inputs with real vent rows per port (ABC adds Intrachamber); delete the "Response model pending" notes (`OriginalShell.vue:366,561`) | `OriginalShell.vue:559-585` | browser spec `original-vented-tab` style: typing diameter on rear/front/intra changes that vent only (run alone) | maybe (layout, 2561) | 4 |
| 6 | Desktop Box tab: Ffc bound to the front chamber (fix after step 3), Frc tooltip/label as WinISD | `OriginalShell.vue:343` | browser spec: Ffc edit reaches `bandpass6.chambers.front` | no | 3 |
| 7 | Mobile Box tab: add Ffc row to the Front chamber panel | `MobileBoxTab.vue:68` | mobile-box-tab browser spec | no | 3 |
| 8 | Mobile Enclosure tab: real vent rows for bp6/ABC, drop the pending note | `MobileEnclosureTab.vue:133`, `MobileEnclosureTab-hooks.ts` | mobile enclosure browser spec | no | 4 |
| 9 | New Project wizard (desktop and mobile): `isDual` for bp6/ABC; step takes Vr, Vf (and tunings); builder passes them through (`rearTuning_hz`, `frontTuning_hz` exist) | `OriginalNewProject-hooks.ts:199,451`, `OriginalNewProject.vue:185`, `MobileNewProject.vue` | hooks spec: wizard with bp6 yields a project with the entered volumes | YES (0 for pages) | 1 |
| 10 | Round trip: .owpr save/load and .wpr import/export of a project built by steps 1-9 gives equal volumes, tunings, vents | `winIsdProjectConverter.ts`, specs | design round-trip spec for both types (existing sample .wpr files give the golden) | no | 1 |
| 11 | Chart and compare check: all charts for both types draw from a fresh project with no error; README parity bullets if the equivalence register changes | `compareOverlays.ts`, `charts.test.ts` | design spec: sweep of a built project is non-null for every chart in `chartsFor` | no | 2 |
| 12 | Flip `BoxEngine.implemented` to true for `bandpass6` and `abc`; update the dim-row browser spec (commit 0a2f2aed), BACKLOG "Box types not yet implemented" (delete section), FEATURES | `BoxEngine.ts:69`, `appState.ts:614`, BACKLOG.md, dim-row spec | existing `implemented` unit test flips first | no | 1-11 |

Order: 0, 1, 3, 2, 4, then 5-8 and 9 in any order, 10, 11, 12. Steps 3 and 7 can go before the capture.
