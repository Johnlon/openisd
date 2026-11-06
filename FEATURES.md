# OpenISD — features

What the app does today, and what is planned.
The comparison with WinISD is in [ARCHITECTURE.md §10](ARCHITECTURE.md#10-feature-comparison-with-winisd-07).
Other tools in this space are in [docs/research/COMPETITIVE_LANDSCAPE.md](docs/research/COMPETITIVE_LANDSCAPE.md).

## Shipped

### Enclosures

- **Box types:** sealed, vented, 4th-order bandpass, 6th-order bandpass, ABC, passive radiator.
- **Box losses:** leakage Ql, absorption Qa and port loss Qp, in WinISD's lossy model; Ql and Qa
  of 10⁶ or more give the lossless result.
- **Vents:** round or slotted, with a count and end correction; a
  transmission-line port model is available.
- **Drivers:** several drivers in one box, wired in series or parallel; dual voice coils.

### Charts

- SPL, transfer function magnitude and phase, group delay.
- Cone excursion for the driver and the radiator, against Xmax.
- Impedance magnitude and phase.
- Port air velocity.
- Maximum SPL (excursion or power limited) and maximum power.
- Amplifier apparent load power (VA).
- Port gain for the vented and bandpass vents, and the passive radiator's transfer function and
  phase.
- The filter chain's magnitude, phase and group delay.
- Several open projects overlaid on one chart.
- A cursor that snaps to peaks and can be locked or typed.
- A help page for each chart, on desktop and phone: how to read the chart, what is good, what
  to fix.

### Design tools

- WinISD's sealed alignment picker (nine Qtc targets) and its five vented alignments
  (QB3, BB4, EBS3, EBS6, C4).
- Vent length from tuning, and tuning from length.
- Radiator added mass for a target tuning.
- EBP gauge.
- Solvers that work in every direction across the T/S relations.
- Data-quality marks on missing and contradictory inputs.
- What-if? (desktop panel and mobile sheet): try values and watch the charts. It never changes the project; closing it discards the values.
- Equation inspector showing the formula behind a value.

### Signal and environment

- Drive voltage or input power, series resistance, Rg placement.
- Filters: high-pass, low-pass, all-pass, Linkwitz transform, parametric EQ, low shelf, high
  shelf, static gain and raised cosine.
- Voice-coil temperature rise, and added mass on the cone.
- Force flat response, and Xmax-limited SPL.
- Temperature, humidity and pressure per project, through WinISD's air model.
- Signal generator that plays a tone.

### Drivers and data

- A bundled catalogue of 1,917 drivers and 81 passive radiators, built from the sibling
  `winisd_drivers` repository, with source links. It is searched by name and filtered by type,
  Fs, the frequency range the maker states, Sd and impedance. The list says which filters are on
  and has a Clear filters button.
- My Drivers and My Passive Radiators, kept in the browser, and driver favourites.
- Driver editor with E/C/N provenance on every field.

### Files and platform

- WinISD `.wdr` and `.wpr`, read and write.
- OpenISD `.owpr` projects and `.owdr` drivers.
- Share a design as a link.
- Several projects open at once, autosaved in the browser.
- A Projects panel (desktop) and pane (phone) listing every saved and open project, with search,
  sort, rename and row actions.
- Deleting a project moves it to a Bin, where it can be restored or deleted for good.
- Options, "Your data": storage used, a request to the browser to keep the data, and a list of
  backups taken before changes and repairs, which can be restored or exported.
- Optional cloud sync to your own Google Drive: projects, drivers, passive radiators, favourites
  and Options, with a log of what it sent and received, and conflict copies named by device.
- Number boxes with step arrows, and spin by dragging left or right on a digit.
- Installable PWA that works offline; an optional Electron desktop build.

## Planned

### Simulation

- Isobaric loading chosen in the app. A WinISD file that states it is already simulated, but the
  New project wizard says "Iso-Barik (not modelled)" and the app has no control for it.
- Transmission line and quarter-wave enclosures; horns.
- Listening distance and off-axis angle (currently fixed at 1 m, on axis).
- Step response.
- Baffle step and diffraction.

### Design and construction

- Net and gross volume from panel thickness, with driver, port and bracing displacement.
- Cut list and panel dimensions.
- Crossover design and multi-way summation.

### Data

- Datasheet text to T/S parameters.
- Import of measured response (FRD, ZMA).
- Impedance measurement to T/S extraction.

Work items and priorities are in [BACKLOG.md](BACKLOG.md).
