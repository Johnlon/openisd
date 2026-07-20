# WinISD screenshot index

Index of the reference screenshots in `docs/winisd/`, grouped by area. Each row links to a per-screenshot detail file in `docs/winisd/info/` with the full field inventory, an ASCII wireframe, and any other notable UI behaviour observed.

## Driver browser (main window, Driver pane)

| Screenshot                                  | View                            | Summary                                                                                                                                         | Detail file                                                                        |
| ------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `view_1_driver_drivers_standard.png`        | Driver tab, Standard placement  | Brand/Model, Placement (Standard/Iso-Barik), Num. of drivers, Voice coil connection, Advanced options (temp rise, VC resistance TC, added mass) | [info/view_1_driver_drivers_standard.md](info/view_1_driver_drivers_standard.md)   |
| `view_1_driver_drivers_iso-barik.png`       | Driver tab, Iso-Barik placement | Same pane with Iso-Barik selected — pair(s) unit suffix, criss-cross wiring icon, two-project overlay                                           | [info/view_1_driver_drivers_iso-barik.md](info/view_1_driver_drivers_iso-barik.md) |
| `view_1_driver_drivers_standard_actual.png` | —                               | **Not a WinISD screenshot.** OpenISD's own Classic-skin comparison capture; see [archive/CLASSIC-SKIN-review.md](../../archive/CLASSIC-SKIN-review.md)          | —                                                                                  |

## Driver editor (modal dialog, 4 tabs)

| Screenshot                                | View                    | Summary                                                                                                                          | Detail file                                                                                |
| ----------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `edit_driver_pg1_text.png`                | General tab             | Manufacturer/Brand/Model, Data provided by/Date added, Comment, ParState legend, Auto-calculate checkbox, Save/Load/Clear/Cancel | [info/edit_driver_pg1_text.md](info/edit_driver_pg1_text.md)                               |
| `edit_driver_pg2_parameters.png`          | Parameters tab          | Thiele/Small, Electro-Mechanical, Large-Signal, Miscellaneous parameter groups                                                   | [info/edit_driver_pg2_parameters.md](info/edit_driver_pg2_parameters.md)                   |
| `edit_driver_pg3_advanced_parameters.png` | Advanced parameters tab | Thermal parameters, Figure of merits, Environment parameters (c, roo shown Calculated)                                           | [info/edit_driver_pg3_advanced_parameters.md](info/edit_driver_pg3_advanced_parameters.md) |
| `edit_driver_pg4_dimensions.png`          | Dimensions tab          | Thick/Depth/Magnet Depth/Magnet/Basket/Outer/VCd/Dvol + labelled cross-section diagram                                           | [info/edit_driver_pg4_dimensions.md](info/edit_driver_pg4_dimensions.md)                   |
| `driver_basket.png`                       | Cropped diagram         | Tight crop of the Dimensions-tab cross-section line art, no labels                                                               | [info/driver_basket.md](info/driver_basket.md)                                             |

## Box / Passive Radiator / Ported panes

| Screenshot                    | View                         | Summary                                                                                                              | Detail file                                                        |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `view_2_box.png`              | Box tab                      | Rear chamber Volume/Fh, box+driver icon, Advanced-> link                                                             | [info/view_2_box.md](info/view_2_box.md)                           |
| `view_3_passive_radiator.png` | Passive Radiator tab         | PR parameters (Vas/Qms/Fs/Sd/Xmax) + User options (Num. of PRs, added mass, Fs w/ added mass)                        | [info/view_3_passive_radiator.md](info/view_3_passive_radiator.md) |
| `view_3_ported.png`           | Vents tab, 2-project overlay | Vent Number/Shape/diameter/length/End Correction/Cross area/1st port resonance; confirms multi-project graph overlay | [info/view_3_ported.md](info/view_3_ported.md)                     |

## Filters (Filter Editor popup, 8 filter types)

| Screenshot                                           | View                       | Summary                                                                                | Detail file                                                                                                      |
| ---------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `view_4_filters_edit_allpass.png`                    | Allpass                    | Order, Q, Delay time                                                                   | [info/view_4_filters_edit_allpass.md](info/view_4_filters_edit_allpass.md)                                       |
| `view_4_filters_edit_dlp_raised_cosine.png`          | DLP Raised Cosine          | Center freq, Gain, Bandwidth (oct)                                                     | [info/view_4_filters_edit_dlp_raised_cosine.md](info/view_4_filters_edit_dlp_raised_cosine.md)                   |
| `view_4_filters_edit_highpass.png`                   | Highpass                   | Subtype dropdown, Order, Q, Cutoff                                                     | [info/view_4_filters_edit_highpass.md](info/view_4_filters_edit_highpass.md)                                     |
| `view_4_filters_edit_linkwitz_transform.png`         | Linkwitz transform         | f0/Q0 (actual), fp/Qp (target)                                                         | [info/view_4_filters_edit_linkwitz_transform.md](info/view_4_filters_edit_linkwitz_transform.md)                 |
| `view_4_filters_edit_lowpass.png`                    | Lowpass, Subtype expanded  | Full subtype list: Butterworth, Linkwitz-Riley (4th order only), Bessel, SOS user fc/Q | [info/view_4_filters_edit_lowpass.md](info/view_4_filters_edit_lowpass.md)                                       |
| `view_4_filters_edit_parametric_eq.png`              | Parametric EQ              | Center freq, Gain, Q                                                                   | [info/view_4_filters_edit_parametric_eq.md](info/view_4_filters_edit_parametric_eq.md)                           |
| `view_4_filters_edit_peaking_2nd_order_highpass.png` | Peaking 2nd order highpass | Peak mag, Peak freq                                                                    | [info/view_4_filters_edit_peaking_2nd_order_highpass.md](info/view_4_filters_edit_peaking_2nd_order_highpass.md) |
| `view_4_filters_edit_statis_gain.png`                | Static gain                | Gain only (filename has a typo: "statis")                                              | [info/view_4_filters_edit_statis_gain.md](info/view_4_filters_edit_statis_gain.md)                               |

## Signal / Advanced / Project panes

| Screenshot            | View                            | Summary                                                                                                            | Detail file                                        |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `view_5_signal.png`   | Signal tab                      | Listening place (Distance, Angle) + Signal source (input power, driver voltage, series resistance)                 | [info/view_5_signal.md](info/view_5_signal.md)     |
| `view_6_advanced.png` | Advanced tab                    | Temperature/Humidity/Air pressure -> Sound velocity/Air density, 5 simulation-fidelity checkboxes                  | [info/view_6_advanced.md](info/view_6_advanced.md) |
| `view_7_advanced.png` | Project tab (filename mismatch) | Creator/Created/Modified/Description — despite the filename, the active nav tab shown is "Project", not "Advanced" | [info/view_7_advanced.md](info/view_7_advanced.md) |

## Options dialog

| Screenshot                | View            | Summary                                                                                                                            | Detail file                                                |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `options_general.png`     | General tab     | Username, Environment (Temperature/Air pressure/Humidity/Sound velocity), Reset to Metric button                                   | [info/options_general.md](info/options_general.md)         |
| `options_plot_window.png` | Plot Window tab | Colour swatches (0dB/-3dB/Background/Other lines/Labels/Xmax limit) + full chart Limits table (Start/End/Unit per chart dimension) | [info/options_plot_window.md](info/options_plot_window.md) |

## Charts

| Screenshot                              | View                              | Summary                                                                           | Detail file                                                                            |
| --------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `chart_dropdown.png`                    | Chart-type selector, expanded     | Full list of ~20+ chart types grouped by driver/PR/port/filter category           | [info/chart_dropdown.md](info/chart_dropdown.md)                                       |
| `chart_spl.png`                         | SPL chart                         | Absolute dB scale (42-102 dB), single yellow trace                                | [info/chart_spl.md](info/chart_spl.md)                                                 |
| `chart_transfer_function_magnitude.png` | Transfer function magnitude chart | Relative dB scale (-28 to +4 dB), 0dB/-3dB dashed reference lines, live crosshair | [info/chart_transfer_function_magnitude.md](info/chart_transfer_function_magnitude.md) |

## Cross-cutting notes

- Several screenshots (`view_1_driver_drivers_standard.png`, `chart_spl.png`, `edit_driver_pg4_dimensions.png`) show a faint ghost-text overlay bleeding across one edge of the image — an unrelated capture artifact, not a WinISD UI feature. Flagged per-file above; not evidence of anything in-app.
- `view_4_filters_edit_allpass.png` additionally shows a Windows "Snipping Tool" toast notification, incidental OS chrome from the capture process.
