# Testing Goal: UI Surface Reduction, Mockable Hook APIs & Full Acceptance Scenarios

> **User Goal (2026-09-09):**
> *"ok I want you you do the same analysis of every vue file - the goal is to reduce the testable surfact of the UI to the smallest set possible so that it will run as fast as possible - this is necessary because we can't run lots of ui tests in parallal (or at least last time we tried we had problems - WE SHOULD TRY AGAIN) - and because of serial running then test cases requiring UI are very expensive. So by moving to the logic and then unit testing we can achieve faster thruput. the idea si that the ui tests can uses mocking of the logic if we push ahed. however I do want to test parallel run of ui as there is no gettign away from it as ctitical for preprod."*
>
> **Acceptance Scenarios Rule (2026-09-09):**
> *"ok so heres the pinch - I also want a fully connected set of scenarios as acceptance tests - essentiaally some subset of the ui tests we already run"*
>
> **UI Test Retention Requirement (2026-09-09):**
> *"so at the moment I want to retain ALL the ui tests we already have"*

---

## 1. Multi-Tier Testing Architecture

To balance developer velocity with 100% release confidence, the test suite is structured into three clear tiers:

```
+-------------------------------------------------------------------------+
| Tier 3: Fully Connected Acceptance Scenarios (Playwright, --workers=4)  |
| ~15-20 End-to-End User Journeys (Real UI + Real Hooks + Real Physics)   |
+-------------------------------------------------------------------------+
| Tier 2: Component UI & Hook Unit Tests (Vitest, Fast Node Execution)     |
| 100% Coverage on packages/ui/src/hooks/X-hooks.ts & Component Mocks      |
+-------------------------------------------------------------------------+
| Tier 1: Core Physics, Solvers & Serialization (Vitest Node Runner)      |
| @openisd/design & @openisd/persistence Unit Tests                       |
+-------------------------------------------------------------------------+
```

1. **Tier 1: Core Physics & Serialization (Vitest Node Runner):**
   - Pure engine, solver, and codec unit tests in `@openisd/design` and `@openisd/persistence`.

2. **Tier 2: Hook Unit Tests & Mocked Component UI (Vitest Node Runner):**
   - **`packages/ui/src/hooks/X-hooks.ts`:** Narrow TypeScript interfaces and real hook implementations. Tested 100% in Vitest (~20ms per test).
   - **Vue Component Tests:** Vue components can be tested against lightweight mock hooks (`createMockXAPI()`) to verify templates and event bindings without browser overhead.

3. **Tier 3: Fully Connected End-to-End Acceptance Scenarios (Playwright Browser Suite):**
   - A curated subset of **15–20 high-fidelity end-to-end user journeys** running against the 100% un-mocked, fully connected application (Real DOM + Real Vue Components + Real Hooks + Real Engine).
   - Executed in parallel (`--workers=4`) for pre-push, pre-prod, and `bash scripts/health-check.sh`.

---

## 2. Fully Connected Acceptance Scenario Suite (Tier 3)

The acceptance suite in `packages/ui/test/scenarios/` covers the 5 critical user journeys:

| Scenario Suite | End-to-End User Journey Covered | Un-mocked Systems Verified |
|---|---|---|
| **1. Project Creation & Driver Selection** | `OgNewProject` wizard $\rightarrow$ open `DriverBrowserWinisd` $\rightarrow$ filter by brand/type chip $\rightarrow$ select driver $\rightarrow$ verify active project parameters | Real DOM, `driverBrowsingState`, `OpenISDDriver`, `OpenISDProject` |
| **2. Driver Editor & Storage Persistence** | Open `DriverEditorModal` $\rightarrow$ edit T/S parameters (Fs, Qts, Vas, Re) $\rightarrow$ save to My Drivers $\rightarrow$ reload browser page $\rightarrow$ verify persisted driver values in localStorage | Real DOM, `DriverEditorModal`, `myDriverRepo`, IndexedDB/localStorage |
| **3. Enclosure Tuning & Real-time Graph** | Switch Box Type (Vented $\rightarrow$ Sealed $\rightarrow$ Bandpass) $\rightarrow$ edit Vb & tuning Fb in `OgTune` $\rightarrow$ verify canvas graph trace redrawn & level lines updated | Real DOM, `OriginalShell`, `OgTune`, `GraphPanel`, 2D Canvas, `Engine` solver |
| **4. File Import/Export & Share Link** | Import `.wdr`/`.wpr`/`.owpr` file $\rightarrow$ export `.wpr`/`.owdr` bytes $\rightarrow$ generate Share URL $\rightarrow$ open Share URL in new context $\rightarrow$ verify exact parameter fidelity | Real DOM, `useApplicationIO`, `fileImportExport`, `urlAppState`, `ProjectRepo` |
| **5. Multi-Project Tab Session** | Open multiple project tabs $\rightarrow$ switch active project focus $\rightarrow$ edit parameter on project A $\rightarrow$ switch to project B $\rightarrow$ verify state isolation | Real DOM, `OriginalShell`, `appState`, `useFocusedProject`, `ManagedProject` |

---

## 3. Execution & Verification Pipeline

- **Pre-commit:** ESLint + Vue-TSC + Tier 1 & 2 Vitest Unit Tests (**< 50s total**).
- **Pre-push / Health Check:** ESLint + Vue-TSC + Tier 1 & 2 Unit Tests + Tier 3 Parallel Playwright Acceptance Scenarios (`--workers=4`, **~3.5 - 5 minutes total**).
