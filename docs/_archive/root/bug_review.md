# Bug Review

## Audit Basis

All non-archived reports were re-read and checked against the current tree. Closure required
current code evidence plus a passing targeted test or a confirmed replacement architecture.
Reports were not closed merely because their original file path disappeared.

Reports already marked `FIXED`, `RESOLVED`, `CLOSED`, `DEFERRED`, or `SUPERSEDED` were left
alone unless the current audit found a contradictory residual defect. Reports found to be fixed
or obsolete were updated in place.

## Remaining P0

- [`BUG_20260817_wpr_passive_radiator_vas_written_in_litres_into_a_cubic_metre_field.md`](bugs/BUG_20260817_wpr_passive_radiator_vas_written_in_litres_into_a_cubic_metre_field.md): broader WDR export still drops driver-editor/project fields; the report tracks F2/F3.
- [`BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md`](bugs/BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md): malformed records can still reach `OpenISDDriver` without a `specs` section.
- [`BUG_20260821_wpr_export_writes_fabricated_constants_over_real_design_state.md`](bugs/BUG_20260821_wpr_export_writes_fabricated_constants_over_real_design_state.md): partial; project-owned fields map correctly, but filters and remaining WPR fields are still dropped.

## Remaining P1

### Compatibility and Physics

- [`BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md`](bugs/BUG_20260813_winisd-will-not-open-the-solve-from-mms-cms-parity-project-so-that-golden-cannot-be-captured.md): required WinISD parity evidence is still unavailable.
- [`BUG_20260814_address-bar-carries-no-design-state-at-all-so-the-url-cannot-share-the-design.md`](bugs/BUG_20260814_address-bar-carries-no-design-state-at-all-so-the-url-cannot-share-the-design.md): live address-bar synchronization is absent.
- [`BUG_20260814_winisd-compatibility-air-does-not-scale-with-temperature-but-winisdair-does.md`](bugs/BUG_20260814_winisd-compatibility-air-does-not-scale-with-temperature-but-winisdair-does.md): blocked on a real WinISD probe and ruling.
- [`BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md`](bugs/BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md): the conflicting WDR oracle still needs WinISD evidence.
- [`BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md`](bugs/BUG_20260821_new_project_invents_box_and_vent_values_instead_of_asking_the_user.md): fabricated geometry is gone, but alignment-driven creation sizing is not implemented.
- [`BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md`](bugs/BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md): numeric formatting parity lacks a 15-digit verification.
- [`BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md`](bugs/BUG_20260907_sealed_resonance_ignores_envUseWinisdAirModel.md): sealed resonance does not honor the selected air model.
- [`BUG_20260907_openisddriver_has_no_internal_environment_override.md`](bugs/BUG_20260907_openisddriver_has_no_internal_environment_override.md): driver-level environment override remains absent.
- [`BUG_20260907_wdr_round_trip_test_has_no_second_generation_fixed_point_check.md`](bugs/BUG_20260907_wdr_round_trip_test_has_no_second_generation_fixed_point_check.md): WDR tests still stop after one cycle.
- [`BUG_20260909_loss_mode_is_app_wide_so_it_is_wrong_for_every_project_but_the_last_one_touched.md`](bugs/BUG_20260909_loss_mode_is_app_wide_so_it_is_wrong_for_every_project_but_the_last_one_touched.md): loss mode remains global instead of project-owned.
- [`BUG_20260824_bandpass4_frc_readout_spec_fails_on_fresh_default_project.md`](bugs/BUG_20260824_bandpass4_frc_readout_spec_fails_on_fresh_default_project.md): fresh Bandpass4 projects lack the expected readout.
- [`BUG_20260824_box_losses_collapsed_to_one_shared_triple_instead_of_per_chamber.md`](bugs/BUG_20260824_box_losses_collapsed_to_one_shared_triple_instead_of_per_chamber.md): partial; chamber losses are separated, but the connecting-port loss shape is unverified.

### Data Model and Validation

- [`BUG_20260821_sectionfor_cannot_distinguish_invalid_driver_type_from_woofer.md`](bugs/BUG_20260821_sectionfor_cannot_distinguish_invalid_driver_type_from_woofer.md): invalid driver type can still fall through to woofer.
- [`BUG_20260821_input_power_inverse_computed_inline_in_shell_with_divergent_no_driver_re.md`](bugs/BUG_20260821_input_power_inverse_computed_inline_in_shell_with_divergent_no_driver_re.md): Signal UI still computes the inverse inline.
- [`BUG_20260821_rme_mcost_numinput_precision_defaults_to_2_not_registry_5.md`](bugs/BUG_20260821_rme_mcost_numinput_precision_defaults_to_2_not_registry_5.md): Rme/Mcost inputs omit their registry precision.
- [`BUG_20260905_sd_marked_noncalculable_in_ini_rows_meta.md`](bugs/BUG_20260905_sd_marked_noncalculable_in_ini_rows_meta.md): Sd metadata still says it cannot be calculated.
- [`BUG_20260908_dq_badge_never_fires_for_a_driver_missing_its_spec_params.md`](bugs/BUG_20260908_dq_badge_never_fires_for_a_driver_missing_its_spec_params.md): missing-parameter drivers do not receive the intended browser DQ badge.
- [`BUG_20260908_driver_editor_autocalculate_checkbox_controls_nothing.md`](bugs/BUG_20260908_driver_editor_autocalculate_checkbox_controls_nothing.md): the checkbox remains inert.

## Remaining P2

### Architecture and Ownership

- [`BUG_20260817_provenance_panel_fs_shows_a_formula_the_engine_never_uses_and_hides_two_it_does.md`](bugs/BUG_20260817_provenance_panel_fs_shows_a_formula_the_engine_never_uses_and_hides_two_it_does.md): partial; Fs is corrected, other provenance routes remain hand-maintained.
- [`BUG_20260818_pr_formulas_and_air_constants_duplicated_outside_engine.md`](bugs/BUG_20260818_pr_formulas_and_air_constants_duplicated_outside_engine.md) is obsolete after the domain rebuild; no active PR-formula duplication remains.
- [`BUG_20260821_use_prefix_names_modules_that_are_not_composables.md`](bugs/BUG_20260821_use_prefix_names_modules_that_are_not_composables.md): non-composable modules still use `use*` names.
- [`BUG_20260821_reactivity_design_computed_short_circuits_on_unchanged_reference.md`](bugs/BUG_20260821_reactivity_design_computed_short_circuits_on_unchanged_reference.md): the invalid reactive sample/documentation remains.
- [`BUG_20260823_box_type_has_three_enumerations_and_two_spellings_of_pr.md`](bugs/BUG_20260823_box_type_has_three_enumerations_and_two_spellings_of_pr.md): box-type vocabularies remain duplicated.
- [`BUG_20260901_two_untyped_browser_wide_lookups_one_a_test_backdoor_that_ships_to_users.md`](bugs/BUG_20260901_two_untyped_browser_wide_lookups_one_a_test_backdoor_that_ships_to_users.md): partial; the test backdoor is gone, but app HMR state remains browser-global.
- [`BUG_20260908_two_winisd_converters_build_and_pass_around_live_domain_objects.md`](bugs/BUG_20260908_two_winisd_converters_build_and_pass_around_live_domain_objects.md): live domain objects still cross the converter boundary.
- [`BUG_20260906_appstate_reimplements_sweep_instead_of_calling_project_sweep.md`](bugs/BUG_20260906_appstate_reimplements_sweep_instead_of_calling_project_sweep.md): partial; delegation exists, but result/error ownership is still split.
- [`BUG_20260908_six_vent_and_pr_group_solve_methods_are_throwing_stubs.md`](bugs/BUG_20260908_six_vent_and_pr_group_solve_methods_are_throwing_stubs.md): decision recorded; full project-level implementation remains.
- [`BUG_20260828_a_check_confuses_box_types_with_driver_types_because_both_spell_PR_the_same.md`](bugs/BUG_20260828_a_check_confuses_box_types_with_driver_types_because_both_spell_PR_the_same.md): partial; the gate is narrowed but not type-aware.
- [`BUG_20260828_coverage_config_measures_a_deleted_package_and_ignores_the_two_newest_ones.md`](bugs/BUG_20260828_coverage_config_measures_a_deleted_package_and_ignores_the_two_newest_ones.md): test projects are fixed, coverage inclusion remains incomplete.
- [`BUG_20260902_the_bridge_derived_nothing_so_every_generated_wdr_lost_its_calculated_fields.md`](bugs/BUG_20260902_the_bridge_derived_nothing_so_every_generated_wdr_lost_its_calculated_fields.md): partial; Dia remains outstanding.
- [`BUG_20260822_archive_bugs_reads_status_headers_inside_code_blocks.md`](bugs/BUG_20260822_archive_bugs_reads_status_headers_inside_code_blocks.md): archive parser still mistakes code examples for status headers.
- [`BUG_20260822_archive_bugs_script_classifies_by_first_status_line_and_carries_per_file_overrides.md`](bugs/BUG_20260822_archive_bugs_script_classifies_by_first_status_line_and_carries_per_file_overrides.md): the override fix is present, but parser correctness remains incomplete.

### UI, Persistence, and Test Infrastructure

- [`BUG_20260826_owpr_file_save_serialises_json_not_yaml.md`](bugs/BUG_20260826_owpr_file_save_serialises_json_not_yaml.md): `.owpr` still uses JSON despite the report's YAML contract.
- [`BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md`](bugs/BUG_20260909_one_shared_owpr_fixture_cannot_satisfy_tests_with_opposite_driver_needs.md): shared fixture remains incomplete for conflicting tests.
- [`BUG_20260909_a_first_visit_opens_with_no_project_so_thirty_browser_tests_time_out.md`](bugs/BUG_20260909_a_first_visit_opens_with_no_project_so_thirty_browser_tests_time_out.md): affected tests still assume a project after clearing storage.
- [`BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md`](bugs/BUG_20260909_tune_panel_tests_call_appState_APIs_that_no_longer_exist.md): partial; one obsolete API call remains.
- [`BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md`](bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md): passive-radiator favourites are not implemented.
- [`BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md`](bugs/BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md): bundled and copied drivers still share favourite identity.
- [`BUG_20260909_the_app_titlebar_and_its_build_datetime_are_gone.md`](bugs/BUG_20260909_the_app_titlebar_and_its_build_datetime_are_gone.md): titlebar removal is deliberate, but no replacement build datetime exists.
- [`BUG_20260824_browser_suite_console_error_on_restore_of_a_state_blob_with_no_project_data.md`](bugs/BUG_20260824_browser_suite_console_error_on_restore_of_a_state_blob_with_no_project_data.md): restore-path error remains undiagnosed.
- [`BUG_20260909_three_wpr_bridge_tests_name_a_golden_in_their_title_but_never_read_it.md`](bugs/BUG_20260909_three_wpr_bridge_tests_name_a_golden_in_their_title_but_never_read_it.md): partial; vented and PR computed-field oracles remain absent.
- [`BUG_20260909_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md`](bugs/BUG_20260909_the_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md): partial; guard/throttling are fixed, resource pressure remains.
- [`BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md`](bugs/BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md): worker throttling is fixed, but WSL/multi-agent pressure remains.

## Deferred or Evidence-Blocked

- Alignment initialization, compatibility-air behavior, the `s-roo` oracle, and the MMS/CMS parity golden require WinISD/Wine evidence or an explicit ruling.
- Tuning paired-quantity policy is deferred by QO126.
- Shared Python driver-type vocabulary is deliberately deferred.
- The two blank-driver solver tests require a product ruling on clear versus revert semantics.

## Verification Notes

- Targeted audit suites passed for the closed items, including WDR/projection, persistence,
  environment, and domain tests.
- The full unit suite reached 2,633 passing tests but still has one architecture dependency-matrix
  failure involving unapproved current UI-to-persistence edges.
- The full browser/preview health gate is not green and was not used as closure evidence for
  individual bug reports.
