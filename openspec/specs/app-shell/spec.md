# App Shell Specification

## Purpose

Defines application shell layout, modal overlays, global key/focus controls, config states, and helper panels.

## Requirements

### Requirement: Global Shell Navigation and UI Modals

The application SHALL render modal controls with backdrop dismissals and escape key closing logic.

#### Scenario: Pressing Escape dismisses modals

- **GIVEN** a modal dialog is open
- **WHEN** the user presses the Escape key
- **THEN** the modal SHALL close.

Verifying Tests:

- packages/ui/test/app.browser.spec.ts
- packages/ui/test/modal-escape.browser.spec.ts
- packages/ui/test/cursor-lock.test.ts
- packages/ui/test/config.test.ts
- packages/ui/test/architecture.test.ts

### Requirement: Vent Tuning Dimensions and Calculations

The application SHALL support vent parameter edits and auto-solve vent dimensions ( Helmholtz resonance ) across box types.

#### Scenario: Vent length recalculations

- **GIVEN** box type vented and tuning frequency Fb set
- **WHEN** vent parameters (D, W, H) are changed
- **THEN** vent length SHALL be recalculated using Helmholtz formulas.

Verifying Tests:

- packages/ui/test/vent-group.test.ts
- packages/ui/test/driver-browser-winisd-controls.browser.spec.ts
