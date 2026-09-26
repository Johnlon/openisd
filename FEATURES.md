# OpenISD — features

What the app does today, and what is planned.
The comparison with WinISD is in [ARCHITECTURE.md §10](ARCHITECTURE.md#10-feature-comparison-with-winisd-07).
Other tools in this space are in [docs/research/COMPETITIVE_LANDSCAPE.md](docs/research/COMPETITIVE_LANDSCAPE.md).

## Shipped

### Enclosures

- **Box types:** sealed, vented, 4th-order bandpass, passive radiator.
- **Box losses:** leakage Ql, absorption Qa and port loss Qp, with the sealed-box loss model
  selectable (WinISD's lossy cubic, conventional, lossless).
- **Vents:** round or slotted, with a count and end correction; a
  transmission-line port model is available.
- **Drivers:** several drivers in one box, wired in series or parallel; dual voice coils.

### Charts

- SPL, transfer function magnitude and phase, group delay.
- Cone excursion for the driver and the radiator, against Xmax.
- Impedance magnitude and phase.
- Port air velocity.
- Maximum SPL (excursion or power limited) and maximum power.
- The filter chain's magnitude, phase and group delay.
- Several open projects overlaid on one chart.
- A cursor that snaps to peaks and can be locked or typed.

### Design tools

- WinISD's sealed alignment picker (nine Qtc targets) and its five vented alignments
  (QB3, BB4, EBS3, EBS6, C4).
- Vent length from tuning, and tuning from length.
- Radiator added mass for a target tuning.
- EBP gauge.
- Solvers that work in every direction across the T/S relations.
- Data-quality marks on missing and contradictory inputs.
- What-if tuning (the Tune panel), which never alters the saved design.
- Equation inspector showing the formula behind a value.

### Signal and environment

- Drive voltage or input power, series resistance, Rg placement.
- Filters: high-pass, low-pass, Linkwitz transform, parametric EQ, low shelf, high shelf.
- Voice-coil temperature rise, and added mass on the cone.
- Force flat response, and Xmax-limited SPL.
- Temperature, humidity and pressure per project, with WinISD's or the CIPM-2007 air model.
- Signal generator that plays a tone.

### Drivers and data

- A bundled catalogue of 1,603 drivers and 79 passive radiators, built from the sibling
  `winisd_drivers` repository, with source links. It is searched by name and filtered by type,
  Fs, Sd and impedance.
- My Drivers and My Passive Radiators, kept in the browser, and driver favourites.
- Driver editor with E/C/N provenance on every field.

### Files and platform

- WinISD `.wdr` and `.wpr`, read and write.
- OpenISD `.owpr` projects and `.owdr` drivers.
- Share a design as a link.
- Several projects open at once, autosaved in the browser.
- Installable PWA that works offline; an optional Electron desktop build.

## Planned

### Simulation

- 6th-order bandpass, ABC and isobaric loading. These are already stored; they need their
  circuits.
- Transmission line and quarter-wave enclosures; horns.
- Listening distance and off-axis angle (currently fixed at 1 m, on axis).
- Amplifier load (VA) chart, port gain, and radiator transfer function charts.
- All-pass, raised-cosine delay and static-gain filters.
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
