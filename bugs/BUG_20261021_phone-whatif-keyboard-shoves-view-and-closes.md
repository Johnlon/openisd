# BUG_20261021_phone-whatif-keyboard-shoves-view-and-closes

**Status:** RESOLVED (T529, fable). Found by John 21 Oct 2026 on Pixel 9 (374x705 CSS px) at test.openisd.app.

## Symptom
On Graph page on mobile (374x705):
1. Open What-if sheet.
2. Scroll down to Drivers row, tap in Drivers input.
3. Keyboard comes up (viewport height shrinks to ~380px); only spin buttons remain visible.
4. After spin, keyboard dismisses (viewport restored to 705px).
5. Page stays shoved up, What-if sheet has closed by itself, only refresh repairs view, reopening What-if shows nothing.

## Root Cause
1. `MobileShell.vue` has a main outer container `.mob-content` with `overflow-y: auto`.
2. When on destination `graph`, the page is supposed to be full-screen fixed without outer scroll.
3. In T439, `stepperPin` was introduced to pin form inputs into view above the virtual keyboard and hold `contentEl.scrollTop`.
4. When tapping the stepper button inside the What-if sheet on Graph tab, `stepperPin` injected padding (`pinSpacePx`) into `.mob-content` and scrolled `contentEl.scrollTop`.
5. Because `.mob-content` shifted between `pointerdown` and `click`, the position of the What-if sheet moved upward by ~40px, placing the sheet's `Close` button directly under the user's tap coordinate (`y=208px`).
6. The resulting `click` event hit the `Close` button, immediately closing the What-if sheet.
7. Furthermore, `contentEl.scrollTop` remained > 0 because `onVisibleResize` had no mechanism to restore scroll on fixed graph destination, leaving the screen permanently shoved up.

## Fix
1. In `packages/ui/src/hooks/MobileShell-hooks.ts`:
   - Guarded `stepperPin` surface methods (`scrollBy`, `setSpacePx`, `belowViewPx`) so that when `destination.value === 'graph'`, scrolling and pin spacing are strictly disabled (`0`).
   - Guarded `onVisibleResize` so that when `destination.value === 'graph'`, `contentEl.scrollTop` is clamped to 0.
2. In `packages/ui/src/ui/shells/mobile/MobileShell.vue`:
   - Added `.mob-content-fixed` class (`overflow: hidden; height: 100%`) when `destination === 'graph'`.
   - Prevented rendering `.mob-pin-space` when `destination === 'graph'`.

## Verification
- Unit test: `packages/ui/test/logic/stepperPin.test.ts` (passing in <1s).
- Browser spec: `packages/ui/test/ui/mobile-sheet.browser.spec.ts` (`phone what-if: keyboard dismiss after stepper does not shove view or close sheet`).
- Typecheck: `bash scripts/quiet-test.sh npm run typecheck` passes.
- Feedback page verified: `node /home/john/work/winisd/ui-gallery/bin/check-answerable.mjs http://localhost:8000/winisd/ui-gallery/fixes/T529/`
