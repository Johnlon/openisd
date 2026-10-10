# Plan: Pure Evidence Extractor, Pipeline Consolidation & Downstream Parsing

## 0. Rulings (John 2026-10-10: "yes stop dead work") — these override the schema below

1. Every reading is kept: `SpecEntry.readings` is a LIST of `RawReading`, each carrying its own `origin: SourceRole`, the document URL, and the reader (text layer or OCR). Two datasheets, or two readers of one sheet, are two readings.
2. Every URL is kept: `data_sources` is a list of `{role, url}`, not one URL per role.
3. Every reading has a `locator` (table/row/column or page/line), like `PrintedItem`.
4. Every reading keeps `label`, the row label as printed, so the label-to-key mapping can be checked and redone.
5. The scraper writes a NEW file, `driver_spec.json`, holding the raw facts it read (John 2026-10-10). It keeps every field it reads, including ones earlier rulings had listed for deletion (sku, manufacturer, title, description and the like): raw facts are never dropped. The record directory keeps its existing name.
5a. openisd's bridge still creates `openisd.json` from `driver_spec.json`, in the new driver-type structure (sections plus the role list).
6. Phase 4 is not "bit-for-bit identical": for every reading, the SI value the bridge derives equals the legacy value, or the change is listed and explained.
7. Dead work, stopped: further Python lib parsing batches, and QT93 step 2 on the old `DriverFile`. openisd's bridge `printed` job is replaced by Phase 2.
8. Ownership: Phases 1 and 3 are winisd_tools tasks (tools); Phase 2 is openisd tasks (bob; T017/T018 are reshaped into it: the Usable/Rejected union is the output of the openisd parser).
9. `reader` is a closed enum: `pypdf`, `pymupdf4llm`, `ocr_<engine>` (one member per OCR engine in use), `html`. A new reader adds a member.
10. `added` (first appearance) is a harvest fact and stays in winisd_tools, in driver_spec.json.
11. The TS schema for driver_spec.json lives in `packages/design/domain/driverSpecSchema.ts` (Zod), checked against model_evidence.py by the parity test.

## 1. Goal
1. **Decouple `winisd_tools`**: Strip out all unit conversions, SI calculations, domain opinions, and role resolutions.
2. **Strict Pydantic Schema**: Replace the legacy calculation-bearing `DriverFile` schema with a strict, formal Pydantic v2 schema (`extra="forbid"`) representing **pure evidence**.
3. **Consolidate Pipeline Stages**: Collapse Stages 4 (Extract) and 5 (Emit) into a single extraction stage that writes the Pydantic evidence record directly. Eliminate all 17 custom `emit.py` files (~5,000 lines of glue code).
4. **Capture All Non-T/S Facts (QT92/QT93)**: Stash every single extracted fact—categories, title words, descriptions, unmapped table rows, and accessory specs—verbatim in `printed: [...]`. Zero data loss.
5. **Move parsing and domain decisions into the `openisd` Bridge**: Move all unit parsing to SI, non-numeric value handling, and role resolution into `openisd/packages/design`, executed directly inside `openisd-bridge.js`.

---

## 2. The Formal Pydantic Schema (`model_evidence.py`)

This strict schema defines the exact structure of the new raw evidence format. **During the transition, this will be saved as `driver_spec.json` (replacing `driver.json` once fully migrated) to prevent breaking legacy test fixtures and goldens.**

```python
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class SourceRole(str, Enum):
    MANUFACTURER_DATASHEET = "manufacturer_datasheet"
    MANUFACTURER_PRODUCT_PAGE = "manufacturer_product_page"
    MANUFACTURER_LISTING_PAGE = "manufacturer_listing_page"
    DISTRIBUTOR_DATASHEET = "distributor_datasheet"
    DISTRIBUTOR_PRODUCT_PAGE = "distributor_product_page"
    DISTRIBUTOR_LISTING_PAGE = "distributor_listing_page"
    MANUAL = "manual"

class RawReading(BaseModel):
    """The verbatim reading extracted from a document. No calculations or opinions."""
    model_config = ConfigDict(extra="forbid")

    actual_reading: str = Field(description="The exact text as printed, e.g. '538.9', '47.33 liters', 'N/A'")
    unit_context: Optional[str] = Field(default=None, description="Header/label unit if separate from cell, e.g. 'cm²'")
    note: Optional[str] = Field(default=None, description="Verbatim condition text, e.g. '2.83V/1m'")

class SpecEntry(BaseModel):
    """A parameter's readings across all visited sources."""
    model_config = ConfigDict(extra="forbid")

    readings: dict[SourceRole, RawReading] = Field(
        description="Keyed by the document role that printed it"
    )

class TransducerSection(BaseModel):
    """Canonical T/S parameters for one transducer section (e.g. woofer or tweeter)."""
    model_config = ConfigDict(extra="forbid")

    Fs: Optional[SpecEntry] = None
    Re: Optional[SpecEntry] = None
    Qms: Optional[SpecEntry] = None
    Qes: Optional[SpecEntry] = None
    Qts: Optional[SpecEntry] = None
    Vas: Optional[SpecEntry] = None
    Sd: Optional[SpecEntry] = None
    Cms: Optional[SpecEntry] = None
    Mms: Optional[SpecEntry] = None
    Rms: Optional[SpecEntry] = None
    Bl: Optional[SpecEntry] = None
    Le: Optional[SpecEntry] = None
    Xmax: Optional[SpecEntry] = None
    Xlim: Optional[SpecEntry] = None
    Znom: Optional[SpecEntry] = None
    Pe: Optional[SpecEntry] = None
    SPL: Optional[SpecEntry] = None
    Outer: Optional[SpecEntry] = None
    Basket: Optional[SpecEntry] = None
    Depth: Optional[SpecEntry] = None
    weight: Optional[SpecEntry] = None

class Specs(BaseModel):
    """Transducer sections for this driver."""
    model_config = ConfigDict(extra="forbid")

    woofer: Optional[TransducerSection] = None
    tweeter: Optional[TransducerSection] = None
    passive_radiator: Optional[TransducerSection] = None

class PrintedItem(BaseModel):
    """All non-T/S facts, categories, type words, and unmapped rows (QT92/QT93)."""
    model_config = ConfigDict(extra="forbid")

    label: str = Field(description="Row label or category tag as printed")
    actual_reading: str = Field(description="Value text as printed")
    origin: SourceRole = Field(description="Document role where found")
    locator: str = Field(description="Exact location in document, e.g. 'table/3/row/2', 'breadcrumb/1'")

class DriverEvidenceFile(BaseModel):
    """THE top-level schema replacing legacy DriverFile. Pure evidence SSOT."""
    model_config = ConfigDict(extra="forbid")

    # Clean identity fields (legacy bookkeeping like 'uuid' and 'definition' are removed)
    manufacturer: str
    brand: str
    model: str
    sku: str
    data_sources: dict[SourceRole, str] = Field(description="Map of source role to resolved URL")
    
    # Raw descriptive metadata (as extracted, no role calculation)
    description: Optional[str] = None
    product_image: Optional[str] = None
    series: Optional[str] = None

    # Mapped T/S parameters
    specs: Specs

    # Complete stash of all unmapped facts, categories, and extra specs
    printed: list[PrintedItem]
```

---

## 3. Pipeline Stages: Before vs. After

### Current State (6 Stages)
| Stage | Name | Role Today |
| :--- | :--- | :--- |
| **Stage 1** | **Discover** | Crawls websites to discover product URLs (seeds). |
| **Stage 2** | **Route** | Routes distributor seeds (Parts Express / SoundImports) to brand plugins. |
| **Stage 3** | **Locate** | Locates and caches datasheets/product pages, verifies model codes. |
| **Stage 4** | **Extract** | Parses HTML/PDFs and dumps raw text to intermediate files (`db/_work/extracted/`). |
| **Stage 5** | **Emit** | Reads intermediate files; runs 17 custom `emit.py` files to map labels, do math, convert units to SI, evaluate roles, and write `driver.json`. |
| **Stage 6** | **Project** | Calls `openisd-bridge.js` to project `driver.json` $\rightarrow$ `openisd.json` + `winisd.wdr`. |

### Target State (Collapsed & Pure Extraction)
| Stage | Name | New Role | Why It Changes |
| :--- | :--- | :--- | :--- |
| **Stage 1** | **Discover** | *(Unchanged)* Crawls websites for product URLs. | Pure harvesting. |
| **Stage 2** | **Route** | *(Unchanged)* Routes distributor URLs to vendor plugins. | Pure harvesting. |
| **Stage 3** | **Locate** | *(Unchanged)* Finds and caches authoritative documents. | Pure harvesting. |
| **Stage 4** | **Extract & Save** | Parses documents, maps vendor labels to canonical keys, stashes unmapped rows/categories in `printed: [...]`, and **validates & writes `DriverEvidenceFile` directly**. | Absorbs Stage 5 file emission. Stores pure string evidence (`actual_reading`, `unit_context`, `source`). No SI math, no unit parsing, no role calculation. Eliminates all 17 `emit.py` files. |
| **Stage 5** | **Project** *(was Stage 6)* | Calls `openisd-bridge.js` via embedded V8. | The bridge does **all** unit parsing, SI conversions, role resolutions, corroboration, and produces `openisd.json` + `.wdr`. |

---

## 4. Architecture & Data Contracts

```mermaid
flowchart TD
    subgraph winisd_tools ["winisd_tools (Stages 1-4: Pure Harvester)"]
        S1["Stage 1: Discover (URLs)"] --> S2["Stage 2: Route (Distributors)"]
        S2 --> S3["Stage 3: Locate (Datasheets & Pages)"]
        S3 --> S4["Stage 4: Extract & Save (extract.py)"]
        S4 -->|Directly validates DriverEvidenceFile & writes| DB["driver_spec.json (in winisd_drivers/db)"]
    end

    subgraph bridge ["Stage 5: Embedded V8 Bridge (openisd-bridge.js / winIsdDriverConverter.ts)"]
        DB -->|ctx.call('driverSpecJsonToOpenisdAndWdr', [rawJson])| BR_ENTRY["bridge.ts / winIsdDriverConverter.ts"]
        BR_ENTRY --> U["domain/units.ts (Parse raw text -> SI)"]
        BR_ENTRY --> R["domain/publishedRoles.ts (Resolve roles from printed & metadata)"]
        U --> SEL["selectOrigin.ts & corroboration.ts"]
        R --> EMIT["Emit openisd.json & winisd.wdr"]
        SEL --> EMIT
    end
```

### The Boundary Contract:
- **`winisd_tools` output (`driver_spec.json`)**:
  - Validated strictly by `DriverEvidenceFile` (`extra="forbid"`).
  - No `read_value`, no float calculations, no `rejected` status.
- **`openisd-bridge.js` input & responsibilities**:
  - Receives raw `driver_spec.json` text across the embedded V8 boundary.
  - Runs `domain/units.ts` to parse raw strings into canonical SI numbers for simulation.
  - Runs `domain/publishedRoles.ts` to resolve `driver_type` role collections from `printed` categories/type words and top-level metadata.
  - Handles non-numeric values (`"N/A"`, `"-"`) by assigning domain states (`state: 'N'`).
  - Returns compiled `openisd.json` and `.wdr` byte payloads back to Python.

---

## 5. Phased Implementation Steps

### Phase 1: Define Schemas & Migration Strategy
Because `DriverEvidenceFile` is a completely new file format, its schemas must be authored first before modifying extractors or the bridge.

1. **Author Python Pydantic Schema (`model_evidence.py`)**:
   - Define `DriverEvidenceFile` and all sub-models as `extra="forbid"`.
   - Use this to eventually serialize `driver_spec.json`.
2. **Author TypeScript Zod Schema (`openisdSchema.ts`)**:
   - Align `packages/design/domain/openisdSchema.ts` to strictly validate `driver_spec.json` via Zod.
3. **Migration Strategy & Goldens**:
   - Establish that the new format will be named `driver_spec.json` to prevent breaking existing `driver.json` test fixtures during the transition.

---

### Phase 2: Build Downstream Parser in `openisd` Bridge (TDD First)
Before changing the scrapers, equip `openisd-bridge.js` to ingest `driver_spec.json`:

1. **Port unit test cases to TypeScript**:
   - Port `winisd_tools/scrapers/tests/lib/test_units.py` to `openisd/packages/design/test/domain/units.test.ts`.
2. **Implement `packages/design/domain/units.ts`**:
   - Parse numbers, fractions (`1/2"`), decimal locales. Map units to SI factors.
3. **Port `published_roles.py` to TypeScript**:
   - Create `packages/design/domain/publishedRoles.ts`. Resolve `driver_type` roles.
4. **Wire into `winIsdDriverConverter.ts` & `bridge.ts`**:
   - Update the bridge converter to accept `driver_spec.json` using the new Zod schema.
   - Rebuild `packages/design/dist/openisd-bridge.js`.

---

### Phase 3: Collapse Stage 4 & 5 into Direct Extraction
1. **Stage 4 Returns Typed Pydantic Models**:
   - Modify vendor extractors (Stage 4) to output structured Pydantic models (`TransducerSection`, `Specs`), not untyped flat dictionaries.
   - Extractors automatically route all unmapped rows, categories, and extra specs into `printed: list[PrintedItem]`.
2. **Validate & Write `driver_spec.json` Directly**:
   - Validate with `DriverEvidenceFile` and write `driver_spec.json` at the conclusion of Stage 4.
   - Delete all 17 custom `emit.py` files.
   - Remove legacy Stage 5 from `framework.py` and rename Stage 6 (Project) to Stage 5.
   - Eliminate temporary `_work/extracted/` queues.

---

### Phase 4: Full End-to-End Verification
1. **Bridge Parity Verification**:
   - Verify that parsing the new `driver_spec.json` through the bridge produces bit-for-bit identical `openisd.json` and `.wdr` files as the legacy pipeline.
2. **Corpus Rebuild**:
   - Rebuild corpus into a scratch database to verify all 17 vendor pipelines run cleanly and produce accurate `driver_spec.json` outputs.
