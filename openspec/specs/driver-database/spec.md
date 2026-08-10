# Driver Database Specification

## Purpose

Defines driver library loading, search, serialization, and import/export behaviors in WinISD (.wdr, .wpr) formats.

## Requirements

### Requirement: Driver Class & Low-level Parameter Solving

The library SHALL provide a representation of driver parameters resolving units, scaling, and validation rules.

#### Scenario: Parse and project parameter set

- **GIVEN** a raw parameter dictionary
- **WHEN** projected into the Driver object
- **THEN** internal fields are scaled correctly (e.g. Fs in Hz, Vas in L) and invalid fields are rejected.

Verifying Tests:

- packages/winisd/test/driver-class.test.ts
- packages/winisd/test/driver-derive.test.ts
- packages/winisd/test/driver-hardening.test.ts
- packages/winisd/test/driver-json.test.ts
- packages/winisd/test/driver-projection.test.ts
- packages/winisd/test/openisdDerive.test.ts
- packages/winisd/test/openisdRecord.test.ts
- packages/winisd/test/openisdYaml.test.ts

### Requirement: File Import / Export Formats (.wdr, .wpr, .owdr)

The platform MUST support parsing legacy WinISD driver files (.wdr), WinISD project files (.wpr), and OpenISD native JSON format (.owdr) without losing custom metadata.

#### Scenario: Round-trip WDR serialization

- **GIVEN** a legacy WinISD .wdr file
- **WHEN** loaded and written back to disk
- **THEN** output matches byte-for-byte or conforms strictly to layout rules.

Verifying Tests:

- packages/winisd/test/driver-roundtrip.test.ts
- packages/winisd/test/roundtrip.test.ts
- packages/winisd/test/wdr.test.ts
- packages/winisd/test/wpr.test.ts

### Requirement: Library Search and Organization

The UI SHALL allow browsing, searching, and filtering drivers inside the database using brand, model, sizes, and type chips.

#### Scenario: Filtering by brand name

- **GIVEN** a search string
- **WHEN** typing in the search box
- **THEN** the list filters down to match brand or model tags.

Verifying Tests:

- packages/ui/test/driver-search-name.test.ts
- packages/ui/test/driver-search-interactive.browser.spec.ts
- packages/ui/test/driver-favorites.browser.spec.ts
- packages/ui/test/driver-count.browser.spec.ts
- packages/ui/test/drivers-bundle.test.ts
- packages/ui/test/driver-scope-chip.browser.spec.ts
- packages/ui/test/driver-summary-winisd.browser.spec.ts
