# UI/UX design — hub

**This hub is the UI/UX design SSOT entrypoint; the linked docs are authoritative.**
Created 2026-07-20 per `../winisd_tools/brain/DESIGN_DOCS_RATIONALISATION_PLAN.md` — a
hub, not a copy: it indexes the scattered UI/UX design corpus so there is one place to
start. Companion aspect hub: [design/UX.md](design/UX.md).

## §UI — the look (visual / component design)

- [mock/MOCK_DESIGN.md](mock/MOCK_DESIGN.md) — mockup visual design decisions + open
  questions (the active UI-design notes; `archive/MOCK_PROMPTS.md` holds the verbatim
  prompt history behind it).
- [.claude/context/ui-rules.md](.claude/context/ui-rules.md) — enforced Vue
  component/visual rules (tooltips, symmetry, no stretch-fit fields, …).
- [docs/winisd/winisd_boxtypes.md](docs/winisd/winisd_boxtypes.md) — box-type
  panel/diagram visual reference (the WinISD cutaway icons the app reproduces).

## §UX — interaction model (views / dialogs / flows / inputs)

- [docs/winisd/INPUT_PARITY.md](docs/winisd/INPUT_PARITY.md) — field-by-field
  WinISD ↔ OpenISD input-parity evidence ledger.
- [docs/winisd/SCREENSHOTS_INDEX.md](docs/winisd/SCREENSHOTS_INDEX.md) — catalogue of the
  WinISD 0.7.0.950 reference screenshots each info file below is derived from.

### The `docs/winisd/info/` corpus — per-view WinISD field/flow inventories

The de-facto UX SSOT: one file per WinISD view/dialog, documenting every field, control,
and flow being reproduced.

| File | What it documents |
|---|---|
| [docs/winisd/info/view_1_driver_drivers_standard.md](docs/winisd/info/view_1_driver_drivers_standard.md) | Main-window Driver pane, Standard placement mode |
| [docs/winisd/info/view_1_driver_drivers_iso-barik.md](docs/winisd/info/view_1_driver_drivers_iso-barik.md) | Main-window Driver pane, Iso-Barik placement mode |
| [docs/winisd/info/view_2_box.md](docs/winisd/info/view_2_box.md) | Main-window Box pane (layout) |
| [docs/winisd/info/view_3_ported.md](docs/winisd/info/view_3_ported.md) | Vents (ported box) pane with two projects overlaid on one graph |
| [docs/winisd/info/view_3_passive_radiator.md](docs/winisd/info/view_3_passive_radiator.md) | Passive Radiator pane (layout) |
| [docs/winisd/info/view_4_filters_edit_highpass.md](docs/winisd/info/view_4_filters_edit_highpass.md) | Filter Editor popup, Highpass filter type |
| [docs/winisd/info/view_4_filters_edit_lowpass.md](docs/winisd/info/view_4_filters_edit_lowpass.md) | Filter Editor popup, Lowpass with the Subtype dropdown expanded |
| [docs/winisd/info/view_4_filters_edit_allpass.md](docs/winisd/info/view_4_filters_edit_allpass.md) | Filter Editor popup, Allpass filter type |
| [docs/winisd/info/view_4_filters_edit_parametric_eq.md](docs/winisd/info/view_4_filters_edit_parametric_eq.md) | Filter Editor popup, Parametric EQ filter type |
| [docs/winisd/info/view_4_filters_edit_linkwitz_transform.md](docs/winisd/info/view_4_filters_edit_linkwitz_transform.md) | Filter Editor popup, Linkwitz transform filter type |
| [docs/winisd/info/view_4_filters_edit_dlp_raised_cosine.md](docs/winisd/info/view_4_filters_edit_dlp_raised_cosine.md) | Filter Editor popup, DLP Raised Cosine (delay) filter type |
| [docs/winisd/info/view_4_filters_edit_peaking_2nd_order_highpass.md](docs/winisd/info/view_4_filters_edit_peaking_2nd_order_highpass.md) | Filter Editor popup, Peaking 2nd-order highpass filter type |
| [docs/winisd/info/view_4_filters_edit_statis_gain.md](docs/winisd/info/view_4_filters_edit_statis_gain.md) | Filter Editor popup, Static gain filter type |
| [docs/winisd/info/view_5_signal.md](docs/winisd/info/view_5_signal.md) | Signal pane (listening place + signal source) |
| [docs/winisd/info/view_6_advanced.md](docs/winisd/info/view_6_advanced.md) | Advanced pane (environment model + simulation toggles) |
| [docs/winisd/info/view_7_advanced.md](docs/winisd/info/view_7_advanced.md) | Project pane (filename says "advanced" but shows the Project tab) |
| [docs/winisd/info/edit_driver_pg1_text.md](docs/winisd/info/edit_driver_pg1_text.md) | Driver editor dialog, General tab (1 of 4) |
| [docs/winisd/info/edit_driver_pg2_parameters.md](docs/winisd/info/edit_driver_pg2_parameters.md) | Driver editor dialog, Parameters tab (2 of 4; layout — fields in INPUT_PARITY) |
| [docs/winisd/info/edit_driver_pg3_advanced_parameters.md](docs/winisd/info/edit_driver_pg3_advanced_parameters.md) | Driver editor dialog, Advanced parameters tab (3 of 4; layout) |
| [docs/winisd/info/edit_driver_pg4_dimensions.md](docs/winisd/info/edit_driver_pg4_dimensions.md) | Driver editor dialog, Dimensions tab (4 of 4; layout) |
| [docs/winisd/info/options_general.md](docs/winisd/info/options_general.md) | Options dialog (app preferences), General tab |
| [docs/winisd/info/options_plot_window.md](docs/winisd/info/options_plot_window.md) | Options dialog, Plot Window tab |
| [docs/winisd/info/chart_dropdown.md](docs/winisd/info/chart_dropdown.md) | Toolbar chart-type dropdown, full option list expanded |
| [docs/winisd/info/chart_spl.md](docs/winisd/info/chart_spl.md) | SPL chart on the Driver pane (chart documented in isolation) |
| [docs/winisd/info/chart_transfer_function_magnitude.md](docs/winisd/info/chart_transfer_function_magnitude.md) | Transfer-function-magnitude chart on the Driver pane |
| [docs/winisd/info/driver_basket.md](docs/winisd/info/driver_basket.md) | Driver basket/magnet cross-section diagram (cropped line-art reference) |
