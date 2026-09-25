# Tasks

## 1. Engine — loss-mode calc
- [ ] 1.1 Add `LossMode` enum (`Lossless`, `ConventionalLossy`, `WinisdLossy`) in `packages/engine/src`.
- [ ] 1.2 Add `sealedFcLossless(fs, vas, vb)` = `fs·√(1+Vas/Vb)`.
- [ ] 1.3 Add `sealedFscWinisd({fs, vas, qts, vb, ql, qa})` — the lossy 3rd-order cubic from
      `SEALED_FSC_MODEL.md` (§3): intermediates → `a1/a2/a3` → solve `s³+a3·s²+a2·s+a1` → `|pole|/2π`.
- [ ] 1.4 Add `sealedResonance(mode, params)` dispatcher returning `{ fsc, qtc }` for the selected mode.
- [ ] 1.5 Unit tests against the WinISD oracle grid (bit-exact for WinisdLossy; lossless limit as QL→∞).

## 2. State — loss-mode parameter
- [ ] 2.1 Add `lossMode` to the box state (default `WinisdLossy`), parse-once at the string boundary.
- [ ] 2.2 Persist/restore `lossMode` with the rest of the box parameters.

## 3. UI — Box tab selector
- [ ] 3.1 Add the three-option selector to `BoxPanel.vue` (default WinISD Lossy).
- [ ] 3.2 Compute the Box tab `Fsc`/`Qtc` readout from the selected mode via the engine.
- [ ] 3.3 Browser (Playwright) test: selector present, default = WinISD, switching updates `Fsc`.

## 4. Spec traceability
- [ ] 4.1 Link each new engine test to the `core-engine` requirement; each browser test to `ui-presentation`.
- [ ] 4.2 `openspec validate add-sealed-box-loss-mode --strict` passes.
- [ ] 4.3 `bash scripts/health-check.sh` green.
