# Bug ledger audit — release-gate row 4

Audit of every file in `bugs/` against row 4 of the release gate: *every `bugs/*.md` RESOLVED or
carrying an explicit human DEFERRED ruling*.

Run 2026-08-22 by opus1 at `38bd5cd`, 59 records. Every verdict below was established by reading
the code or running the command named in its evidence column — never by reading the record's own
status line.

## Verdict

**Row 4 fails.** Of 59 records: 13 verified RESOLVED, 3 claimed resolved but unverifiable, 8 mixed
(part fixed, part open), 1 blocked, and the balance open with no human ruling. Five records contain
wording resembling a human ruling and three of those are agent-authored deferrals rather than
John's words.

## Verified resolved

| record | evidence |
|---|---|
| dvol geometry relation | `packages/engine/src/dvolRelation.ts`; `driver.ts:254-273`; `engine/test/dvolRelation.test.ts` |
| questions_yml_duplicate_QO56 | `questions.yml` — one `- id: QO56`, at :5804 |
| original_skin_spec_reads_state_p | no `state.P` in `ui/test/ui/original-skin.browser.spec.ts` |
| archive_bugs_script_classifies_by_first_status_line | `scripts/archive-bugs.py:23-45` walks the whole status region; per-file overrides gone |
| bridge_bundle_emits_yaml_parser_warnings | `packages/model/src/openisdYamlToWdr.ts:35` parses at `logLevel: 'error'` |
| filefile_ts_docstring_cites_deleted_fileio_ts | no `fileIO.ts` reference anywhere in `packages/ui/src` |
| share_links_bypass_schema_upgrade | `persist.ts:123` — `loadFromHash` routes through `upgradeParsedState`; present in HEAD |
| component_liveref_subscriptions_never_disposed | `liveProject.ts:14` imports `onScopeDispose`; :27-31 documents the teardown |
| driverstanding_throws_on_no_quality_block | `driverStanding.ts:13` derives from `missing`/`parse_errors` only |
| openisd_reads_disposition | `disposition` survives only in two docstring lines stating it is never read |
| bundle_drivers_cli_guard_breaks_under_vite_node | `scripts/bundle-drivers.mjs` — `import.meta` computes ROOT only; the guard is gone |
| wpr_import_reads_wrong_simulatoroptions_keys | `wpr.ts:367-369` read keys match `:254-256` write keys |
| consistency_relations_miss_the_ebp_fs_route | `consistency.ts:109` — `{ formula: 'EBP = Fs/Qes', target: 'EBP' }` |

## Claimed resolved, unverified

Marked unverified rather than green: a mark without a test is a guess.

- `pr_group_auto_solve_watch_never_fires_after_the_live_repoint` — the module it names is gone
  under the persistence rename; the successor watch was not located. Routed to the rename's author.
- `wpr_import_leaves_previous_projects_meta_in_state` — `state.project` syncing found in
  `useDesignIO.ts`, but not on the `.wpr` import path specifically.
- `archive_sweep_moved_a_partially_open_bug` — `bugs/` 59 vs `archive/` 68; the specific restored
  file was not confirmed.

## Mixed-status records, and what was verified fixed in each

Each of these carried one fixed item and one open item in a single file. Row 4 cannot pass on a
file in that shape, so each record now states only its open item. The fixed halves are recorded
here and nowhere else.

| record | fixed half, verified | open half retained |
|---|---|---|
| wdr-spl-is-discarded-on-import | SPL no longer discarded on import | adjacent parity item |
| winisd-will-not-open-the-solve-from-mms-cms | harness dialog handling fixed 2026-08-14 | golden for solve-from-mms-cms not captured |
| cycling_a_wdr_destroys_15_entered_fields | the 15-field silent drop is fixed | `KLe` never computed |
| deploy_verifies_asset_freshness | the deploy-check gap is closed | the underlying app fault |
| provenance_panel_fs_shows_a_formula | the panel entry fixed 2026-08-17 | engine/WinISD parity, QO50 |
| wpr_passive_radiator_vas_in_litres | the litres-into-m³ write site is fixed | F2/F3 sub-findings, moved to BACKLOG.md |
| architecture_sweep_calc_in_store | V2 and V3 resolved | V1 (`syncedP` inline sqrt) and V4 |
| pr_formulas_and_air_constants_duplicated | engine containment satisfied | domain-getter form, awaiting John |

## Requiring a ruling from John

1. `milestone_playwright_run_166_failures` — closed on reasoning with no re-run. Settled by the
   frozen-tree Playwright run at the release gate: green confirms the closure, red revives it.
2. `pr_formulas_and_air_constants_duplicated_outside_engine` — the record asks directly whether
   engine containment is the accepted resolution or the deeper restructuring is required.
3. `address-bar-carries-no-design-state` — deferred to the OpenISDDriver migration by an agent,
   not by a human ruling.
4. `winisd-compatibility-air-does-not-scale-with-temperature` — blocked on a probe against the
   real WinISD binary.
5. `s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule` — research-blocked.
6. `winisdAir_compat_mode_fidelity_questionable` — research-blocked, pairs with 5.
7. `epique15_sample_wpr_is_hand_authored_and_treated_as_an_oracle` — oracle validity.
8. `record_stores_dimension_fields_in_mm_litres_instead_of_si` — carries "human ruling: this is a
   bug" with no disposition; rides the migration pass.
