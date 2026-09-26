# Known bugs

Every record in [`bugs/`](bugs/) is re-verified against the code (2026-09-26). Resolved,
closed and obsolete records are in [`bugs/archive/`](bugs/archive/). The table below is every
record still in `bugs/` — the full set, not a curated subset.

## Open

| Behaviour                                                                                                  | Record                                                                                                         |
|--------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| WinISD crashes capturing the `solve-from-mms-cms` parity scenario; no golden exists for it.                | [solve-from-mms-cms-parity](bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md) |
| `.wpr` export writes PR `alfaVC`/`dTVC` as literals instead of the project's own values.                   | [wpr-pr-alfaVC-dTVC](bugs/BUG_20260817_wpr_passive_radiator_vas_written_in_litres_into_a_cubic_metre_field.md)   |
| `drivers/mysamples/winisd/s-roo.wdr` contradicts the researched c-from-Roo recompute rule.                 | [s-roo-oracle](bugs/BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md)                  |
| The wizard still writes a 0.05 m vent and a 35 Hz tuning as literals instead of deriving them.              | [wizard-invents-values](bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md) |
| `docs/design/REACTIVITY.md`'s sample `createLiveRef` still shows the broken short-circuit.                 | [reactivity-doc-sample](bugs/BUG_20260821_reactivity_design_computed_short_circuits_on_unchanged_reference.md)   |
| Rme/Mcost NumInputs default to 2 dp; the field registry declares 5.                                        | [rme-mcost-precision](bugs/BUG_20260821_rme_mcost_numinput_precision_defaults_to_2_not_registry_5.md)            |
| `referenceC`/`referenceRho` in `environment.ts` duplicate `airFor({})` with no callers.                    | [reference-air-wrappers](bugs/BUG_20260821_seven_reference_air_wrappers_duplicate_airFor.md)                     |
| Modules named `use*` exist that are not composables.                                                       | [use-prefix-non-composables](bugs/BUG_20260821_use_prefix_names_modules_that_are_not_composables.md)             |
| `.wpr` export writes Nd, Isobarik, alfaVC, dTVC and filter count as fabricated literals.                   | [wpr-fabricated-constants](bugs/BUG_20260821_wpr_export_writes_fabricated_constants_over_real_design_state.md)   |
| `.wpr` export formats floats with `String(v)`, not WinISD's 15-digit format.                               | [wpr-float-formatting](bugs/BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md)                 |
| `archive-bugs.py` reads `# Status` headers found inside code blocks as real status lines.                  | [archive-bugs-code-blocks](bugs/BUG_20260822_archive_bugs_reads_status_headers_inside_code_blocks.md)            |
| `.wpr` import reads no per-chamber loss keys; every imported bandpass4 project gets default losses.        | [box-model-per-chamber-losses](bugs/BUG_20260823_box_model_collapses_per_chamber_losses.md)                      |
| `BoxTypeDiagram.vue` declares a second literal union alongside `BoxType`, with two spellings of PR.        | [box-type-three-enumerations](bugs/BUG_20260823_box_type_has_three_enumerations_and_two_spellings_of_pr.md)      |
| The bandpass4 Frc readout reads `box.sealed.resonance_hz` while the user edits `box.bandpass4.chambers...`.| [bandpass4-frc-readout](bugs/BUG_20260824_bandpass4_frc_readout_spec_fails_on_fresh_default_project.md)          |
| `.owpr` project save is JSON while driver records moved to `openisd.json`; needs a ruling.                 | [owpr-json-not-yaml](bugs/BUG_20260826_owpr_file_save_serialises_json_not_yaml.md)                               |
| `appState.ts` still installs `globalThis.__store_context`, a test-only backdoor that ships to users.       | [store-context-backdoor](bugs/BUG_20260901_two_untyped_browser_wide_lookups_one_a_test_backdoor_that_ships_to_users.md) |
| The `.wdr` writer passes `calculable: false` for a derived Sd, so it is written as E.                      | [sd-noncalculable](bugs/BUG_20260905_sd_marked_noncalculable_in_ini_rows_meta.md)                                |
| `appState` calls `p.sweep()` but still runs its own classify checks alongside the sweep's own issues.      | [appstate-reimplements-sweep](bugs/BUG_20260906_appstate_reimplements_sweep_instead_of_calling_project_sweep.md) |
| No per-driver stored environment override — feature idea, needs a ruling to build or close.                | [driver-environment-override](bugs/BUG_20260907_openisddriver_has_no_internal_environment_override.md)          |
| The embedded driver's air provider omits `useWinisdAirModel`, so sealed resonance can derive Vas wrong.    | [sealed-resonance-air-model](bugs/BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md)                 |
| `.wdr` round-trip test cycles each file once; no second-generation fixed-point check.                      | [wdr-round-trip-once](bugs/BUG_20260907_wdr_round_trip_test_has_no_second_generation_fixed_point_check.md)       |
| `cursor-lock.test.ts` tests logic and CSS it copies into itself rather than the real source.               | [cursor-lock-test-self-asserts](bugs/BUG_20260908_cursor_lock_test_asserts_against_logic_and_css_it_declares_itself.md) |
| Passive radiators have no favourites star (drivers have one).                                              | [pr-no-favourites](bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md)                           |
| The build date is defined at build time but shown nowhere in the UI.                                       | [titlebar-build-date-gone](bugs/BUG_20260909_the_app_titlebar_and_its_build_datetime_are_gone.md)                |
| `project.driver.issues()` returns `[]` while `specs.Qts.dq` holds `inconsistent-inputs`; OgTune misses it. | [ogtune-issues-empty](bugs/BUG_20260916_ogtune-driver-issues-embedded-returns-empty-when-cascade-has-issues.md)  |
| Tuning targets and vent diameter write `box.vented.*` for every box type, including bandpass4.             | [bandpass4-writes-vented-cell](bugs/BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell.md)           |
| Hand-entered PR fields never derive Mms/Cms; the derivation functions are only called from engine tests.   | [pr-hand-entry-no-derivation](bugs/BUG_20260918_hand-entered-passive-radiators-never-derive-mms-cms.md)          |
| The vent length input is editable only once a length is already entered — no way to enter the first one.  | [vent-length-no-entry-path](bugs/BUG_20260918_no-ui-path-to-enter-a-vent-length.md)                              |
| `commitToMyDrivers()` calls `upsert` with no id, so editing a saved driver appends a duplicate row.        | [my-drivers-edit-duplicates](bugs/BUG_20260922_editing-my-drivers-entry-in-place-duplicates-storage-row.md)      |
| The embedded driver's air provider and the sweep use different air models when the project states none.   | [air-models](bugs/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md)                               |
| Sealed-box leakage is modelled as `Ral = Ql/(ω·Cab)` damping, not a physical leak.                          | [sealed-box-leakage](bugs/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md)                     |
| The transfer-function chart's 0 dB reference disagrees with its own passband SPL.                          | [tfmag-reference](bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md)                          |
| Voice-coil inductance changes the impedance curve but not the SPL curve.                                   | [voice-coil-inductance](bugs/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md)                |

## Needs a human ruling

| Behaviour                                                                                                  | Record                                                                                                         |
|--------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| The WinISD-compatibility air mode scales rho/c with temperature; WinISD's own air mode does not.           | [winisd-air-temperature-scaling](bugs/BUG_20260814_winisd-compatibility-air-does-not-scale-with-temperature-but-winisdair-does.md) |
