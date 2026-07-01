# UI rules — Vue components

- Every `<button>` and every nav-like interactive element (toggles, chips, icon-only controls) **must** have a `title` attribute with a plain-English description of what it does. No exceptions.
- Tooltip text should explain the _effect_, not just restate the label — e.g. `title="Set to 2.83V — IEC 60268-5 sensitivity standard"` not `title="2.83V button"`.

- **Box type symmetry rule:** Controls that apply to all box types (e.g. box losses, Vb) must appear in a fixed position common to all types — never inside a box-type-specific block. Box-type-specific controls (vent params, PR params, etc.) go in their own conditional blocks below the shared controls. All box types must have the same structural skeleton; only the middle section varies.

- **WinISD cross-reference rule:** Every tooltip, label, doc section, and default value should mention the WinISD equivalent wherever one exists — the parameter name WinISD uses, its default value, where it appears in the WinISD UI, and any known difference in behaviour. Users migrate from WinISD; they need to map Resonate concepts to what they already know. Examples: `"WinISD default: 10"`, `"called 'Driver input voltage' in WinISD"`, `"WinISD shows this in the Box tab → Advanced→ popup"`.

- **Intrinsic vs tunable rule:** Device-intrinsic parameters (datasheet specs that describe what the component _is_) belong inside a collapsible edit section. Tunable parameters (things the user adjusts during design — added mass, box volume, vent length, losses) must stay permanently visible outside any collapsible block so the user can tweak them without entering edit mode.

- **Driver-field purpose rule (single source of truth):** Every driver-editor field's tooltip lives in exactly one place — the `desc` string of its entry in `PARAMS` (`DriverDefineModal.vue`). Each `desc` **must** state both (a) what the field _is_ and (b) its role in the charts/functionality — either **which graphs it affects** or that it is **descriptive / derived / not simulated**. The "what each graph needs" legend tooltips read from these same `desc` strings (via `tokPurpose`), so there is **no second copy** — never add a parallel field-description map. When adding or changing a field, verify its purpose against `WINISD.md §13.1` **and** the actual engine usage in `packages/engine`, and keep the chart-role clause accurate.

Before shipping any UI change: run `npx playwright test` and complete the post-deploy smoke test. See `.claude/context/testing-js-ui.md`.
