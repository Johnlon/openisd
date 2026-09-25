# Project Management Specification

## Purpose

Defines project loading, saving, serialization, active project selections, and persistent store reactivity in `@openisd/ui`.

## Requirements

### Requirement: Project Loading and Project Serialization

The system SHALL load and save project parameters in WinISD `.wpr` format and native project formats.

#### Scenario: Open a saved project file

- **GIVEN** a valid `.wpr` project file
- **WHEN** imported by the user
- **THEN** parameters SHALL populate the active project and chart simulations recalculate.

Verifying Tests:

- packages/ui/test/logic/openisd-project.test.ts
- packages/ui/test/db/original-projects.browser.spec.ts

### Requirement: Persistent Storage and State Reactivity

The application state, including filters, favorites, and open projects, SHALL persist reactively in `localStorage` across page reloads.

#### Scenario: Restoring state on load

- **GIVEN** existing stored data in `localStorage`
- **WHEN** the application starts up
- **THEN** it SHALL restore the exact state (active project, open tabs) reactively.

Verifying Tests:

- packages/ui/test/logic/persist.test.ts
- packages/ui/test/logic/persistence.browser.spec.ts
- packages/ui/test/logic/store-filters-reactivity.test.ts
- packages/ui/test/logic/store-issue-channel.test.ts

### Requirement: My Drivers Selection and What-If Simulations

The project manager SHALL allow selecting drivers from "My Drivers" library and executing temporary "What-If" parameter modifications.

#### Scenario: Selection of driver copies it to project

- **GIVEN** a driver selected from My Drivers picker
- **WHEN** loaded into the active project
- **THEN** it SHALL copy the parameter set and isolate modifications to the active project only.

Verifying Tests:

- packages/ui/test/db/driver-selection.browser.spec.ts
- packages/ui/test/db/my-drivers.browser.spec.ts
- packages/ui/test/db/my-drivers-filtering.browser.spec.ts
- packages/ui/test/logic/whatif-panel-fields.browser.spec.ts
- packages/ui/test/logic/whatif-panel-shots.browser.spec.ts
