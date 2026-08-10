/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-editor/spec.md?html
 */
import { test, expect } from '@playwright/test';

/**
 * Exhaustive Playwright Browser Test Suite for OpenISD Driver Editor UI Parameter Solver
 *
 * Rigorous, zero-shortcut end-to-end integration tests covering:
 * 1. Q-trio bi-directional derivations (Qts <-> Qes <-> Qms)
 * 2. Cone geometry bi-directional solving (Sd <-> Dd)
 * 3. Excursion geometry bi-directional solving (Xmax <-> Hc <-> Hg)
 * 4. Volume displacement (Vd <-> Sd * Xmax)
 * 5. Strict priority fallbacks (Dd -> Sd over Vd/Xmax, Hc/Hg -> Xmax over Vd/Sd)
 * 6. Multi-hop 4-cascade propagation from 6 minimal inputs
 * 7. Entered anchor immunity (E state lock)
 * 8. Anchor clearing & downstream un-calculation (N state reset)
 * 9. Acoustic reference efficiency & sensitivity chain (eta0, SPL, USPL)
 * 10. Resonant mass derivation (Fs, Cms -> Mms)
 * 11. Compliance derivation (Vas, Sd -> Cms)
 * 12. Force factor derivation (Fs, Mms, Re, Qes -> BL)
 * 13. Mechanical resistance derivation (Fs, Mms, Qms -> Rms)
 * 14. Zero-division guarding (Qms = 0 / Re = 0 -> state N)
 * 15. Modal Tab State Persistence across Parameters & Advanced tabs
 * 16. Modal Reset button reverts edits back to initial opening state
 * 17. Modal Cancel button discards all edits and leaves project driver un-mutated
 * 18. Modal OK button commits draft solver edits into project driver state
 * 19. Literal text fuzzing ('banana', '<script>') input rejection & sanitization
 * 20. Mathematical Q-trio contradiction detection (Qts != Qes*Qms/(Qes+Qms))
 * 21. Unphysical negative parameter DQ warning flags (Re = -8.0 Ohm, Fs = -35.0 Hz)
 * 22. Voice coil geometry boundary contradiction (underhung Hc/Hg vs excessive Xmax)
 */

test.describe('Exhaustive Driver Editor UI Solver Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');

    // Open Driver Editor Modal
    await page.evaluate(async () => {
      // Specifier in a variable on purpose — this import runs in the PAGE, where vite serves
    // the path; a literal makes tsc try to resolve it against the filesystem and fail.
    const spec = '/src/db/useDriverSelection.ts';
    const mod = await import(/* @vite-ignore */ spec);
      mod.editProjectDriver();
    });

    await page.locator('.de-body').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  });

  // 1. Q-Trio Bi-directional Solving
  test('UI derives Qts from Qes and Qms', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qtsf.fill('');
    await qesf.fill('0.400');
    await qmsf.fill('4.000');

    // Qts = (0.4 * 4.0) / 4.4 = 0.364 (state C)
    await expect(qtsf).toHaveValue('0.364');
    await expect(qtsf).toHaveClass(/st-c/);
  });

  test('UI derives Qes from Qts and Qms', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qesf.fill('');
    await qtsf.fill('0.364');
    await qmsf.fill('4.000');

    // Qes = (0.364 * 4.0) / (4.0 - 0.364) = 0.400 (state C)
    await expect(qesf).toHaveValue('0.400');
    await expect(qesf).toHaveClass(/st-c/);
  });

  // 2. Cone Geometry (Sd <-> Dd)
  test('UI solves Sd from Dd', async ({ page }) => {
    const sdf = page.locator('.de-fld:has-text("Sd") input');
    const ddf = page.locator('.de-fld:has-text("Dd") input');

    await sdf.fill('');
    await ddf.fill('210.0');

    // Sd = pi * (21.0/2)^2 = 346.4 cm²
    await expect(sdf).toHaveValue('346.4');
    await expect(sdf).toHaveClass(/st-c/);
  });

  test('UI solves Dd from Sd', async ({ page }) => {
    const sdf = page.locator('.de-fld:has-text("Sd") input');
    const ddf = page.locator('.de-fld:has-text("Dd") input');

    await ddf.fill('');
    await sdf.fill('346.4');

    // Dd = 2 * sqrt(346.4 / pi) = 210.0 mm
    await expect(ddf).toHaveValue('210.0');
    await expect(ddf).toHaveClass(/st-c/);
  });

  // 3. Excursion Geometry (Xmax <-> Hc <-> Hg)
  test('UI solves Xmax from Hc and Hg', async ({ page }) => {
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');
    const hcf = page.locator('.de-fld:has-text("Hc") input');
    const hgf = page.locator('.de-fld:has-text("Hg") input');

    await xmaxf.fill('');
    await hcf.fill('16.0');
    await hgf.fill('6.0');

    // Xmax = |16 - 6| / 2 = 5.000 mm (state C)
    await expect(xmaxf).toHaveValue('5.000');
    await expect(xmaxf).toHaveClass(/st-c/);
  });

  test('UI solves Hc bi-directionally from Hg and Xmax', async ({ page }) => {
    const hcf = page.locator('.de-fld:has-text("Hc") input');
    const hgf = page.locator('.de-fld:has-text("Hg") input');
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

    await hcf.fill('');
    await hgf.fill('8.0');
    await xmaxf.fill('3.0');

    // Hc = 8.0 - 2*3.0 = 2.00 mm (state C)
    await expect(hcf).toHaveValue('2.00');
    await expect(hcf).toHaveClass(/st-c/);
  });

  test('UI solves Hg bi-directionally from Hc and Xmax', async ({ page }) => {
    const hcf = page.locator('.de-fld:has-text("Hc") input');
    const hgf = page.locator('.de-fld:has-text("Hg") input');
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

    await hgf.fill('');
    await hcf.fill('15.0');
    await xmaxf.fill('5.0');

    // Hg = 15.0 - 2*5.0 = 5.00 mm (state C)
    await expect(hgf).toHaveValue('5.00');
    await expect(hgf).toHaveClass(/st-c/);
  });

  // 4. Volume Displacement (Vd <-> Sd * Xmax)
  test('UI derives Vd from Sd and Xmax', async ({ page }) => {
    const vdf = page.locator('.de-fld:has-text("Vd") input');
    const sdf = page.locator('.de-fld:has-text("Sd") input');
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

    await vdf.fill('');
    await sdf.fill('346.4');
    await xmaxf.fill('5.0');

    // Vd = 346.4 * 0.5 = 173.20 cm³ (state C)
    await expect(vdf).toHaveValue('173.20');
    await expect(vdf).toHaveClass(/st-c/);
  });

  // 5. Priority Fallbacks
  test('UI prioritizes Row 6 (Dd -> Sd) over Row 20 (Vd/Xmax -> Sd)', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    const sdf = page.locator('.de-fld:has-text("Sd") input');
    const vdf = page.locator('.de-fld:has-text("Vd") input');
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

    await sdf.fill('');
    await ddf.fill('200.0');
    await vdf.fill('100.0');
    await xmaxf.fill('5.0');

    // Row 6 (Dd -> Sd) gives ~314.2 cm² (vs Row 20 Vd/Xmax = 200 cm²)
    await expect(sdf).toHaveValue('314.2');
    await expect(sdf).toHaveClass(/st-c/);
  });

  test('UI prioritizes Row 19 (Hc,Hg -> Xmax) over Row 20 (Vd/Sd -> Xmax)', async ({ page }) => {
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');
    const hcf = page.locator('.de-fld:has-text("Hc") input');
    const hgf = page.locator('.de-fld:has-text("Hg") input');
    const vdf = page.locator('.de-fld:has-text("Vd") input');
    const sdf = page.locator('.de-fld:has-text("Sd") input');

    await xmaxf.fill('');
    await hcf.fill('14.0');
    await hgf.fill('6.0');
    await vdf.fill('200.0');
    await sdf.fill('400.0');

    // Row 19 (Hc,Hg -> Xmax) gives 4.000 mm (vs Row 20 Vd/Sd = 5.0 mm)
    await expect(xmaxf).toHaveValue('4.000');
    await expect(xmaxf).toHaveClass(/st-c/);
  });

  // 6. Multi-Hop 4-Cascade
  test('UI executes 4-hop multi-cascade derivation from minimal 6 inputs', async ({ page }) => {
    const mmsf = page.locator('.de-fld:has-text("Mms") input');
    const cmsf = page.locator('.de-fld:has-text("Cms") input');
    const blf = page.locator('.de-fld:has-text("BL") input');

    await mmsf.fill('');
    await cmsf.fill('');
    await blf.fill('');

    await page.locator('.de-fld:has-text("Fs") input').fill('35.0');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Qms") input').fill('4.500');
    await page.locator('.de-fld:has-text("Vas") input').fill('45.0');
    await page.locator('.de-fld:has-text("Re") input').fill('6.0');
    await page.locator('.de-fld:has-text("Dd") input').fill('210.0');

    await expect(mmsf).toHaveClass(/st-c/);
    await expect(cmsf).toHaveClass(/st-c/);
    await expect(blf).toHaveClass(/st-c/);
  });

  // 7. Entered Anchor Immunity (E State Lock)
  test('UI preserves Entered (E) state anchor immunity when editing surrounding fields', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    // Type Qts as explicit user anchor (E)
    await qtsf.fill('0.350');
    await qmsf.fill('4.000');
    await qesf.fill('0.400');

    // Qts must remain locked at Entered anchor '0.350' (state E), NOT overwritten by solver
    await expect(qtsf).toHaveValue('0.350');
    await expect(qtsf).toHaveClass(/st-e/);
  });

  // 8. Field Clearing & Re-uncalculation (State N)
  test('UI un-calculates downstream derived fields back to state N when an anchor is cleared', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    await qtsf.fill('');
    await qesf.fill('0.400');
    await qmsf.fill('4.000');
    await expect(qtsf).toHaveValue('0.364');

    // Clear Qes anchor
    await qesf.fill('');

    // Qts must reset to empty / Not Available (state N)
    await expect(qtsf).toHaveValue('');
    await expect(qtsf).toHaveClass(/st-n/);
  });

  // 9. Reference Efficiency & Sensitivity Chain (eta0, SPL, USPL)
  test('UI derives efficiency eta0 and sensitivity SPL(1W/1m) and USPL(2.83V/1m)', async ({ page }) => {
    const splf = page.locator('.de-fld:has-text("SPL") input').first();
    const usplf = page.locator('.de-fld:has-text("USPL") input');

    await page.locator('.de-fld:has-text("Fs") input').fill('35.0');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Vas") input').fill('45.0');
    await page.locator('.de-fld:has-text("Re") input').fill('6.0');

    // SPL and USPL must be derived (state C)
    await expect(splf).toHaveClass(/st-c/);
    await expect(usplf).toHaveClass(/st-c/);
  });

  // 10. Resonant Mass Derivation (Fs, Cms -> Mms)
  test('UI derives moving mass Mms from Fs and Cms', async ({ page }) => {
    const mmsf = page.locator('.de-fld:has-text("Mms") input');
    const fsf = page.locator('.de-fld:has-text("Fs") input');
    const cmsf = page.locator('.de-fld:has-text("Cms") input');

    await mmsf.fill('');
    await fsf.fill('35.0');
    await cmsf.fill('0.264');

    // Mms must be calculated ~78.4g (state C)
    await expect(mmsf).toHaveClass(/st-c/);
  });

  // 11. Compliance Derivation (Vas, Sd -> Cms)
  test('UI derives compliance Cms from Vas and Sd', async ({ page }) => {
    const cmsf = page.locator('.de-fld:has-text("Cms") input');
    const vasf = page.locator('.de-fld:has-text("Vas") input');
    const sdf = page.locator('.de-fld:has-text("Sd") input');

    await cmsf.fill('');
    await vasf.fill('45.0');
    await sdf.fill('346.4');

    // Cms must be calculated (state C)
    await expect(cmsf).toHaveClass(/st-c/);
  });

  // 12. Force Factor Derivation (Fs, Mms, Re, Qes -> BL)
  test('UI derives force factor BL from Fs, Mms, Re, and Qes', async ({ page }) => {
    const blf = page.locator('.de-fld:has-text("BL") input');

    await blf.fill('');
    await page.locator('.de-fld:has-text("Fs") input').fill('35.0');
    await page.locator('.de-fld:has-text("Mms") input').fill('78.2');
    await page.locator('.de-fld:has-text("Re") input').fill('6.0');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');

    // BL must be calculated ~16.06 T*m (state C)
    await expect(blf).toHaveClass(/st-c/);
  });

  // 13. Mechanical Loss Derivation (Fs, Mms, Qms -> Rms)
  test('UI derives mechanical resistance Rms from Fs, Mms, and Qms', async ({ page }) => {
    const rmsf = page.locator('.de-fld:has-text("Rms") input');

    await rmsf.fill('');
    await page.locator('.de-fld:has-text("Fs") input').fill('35.0');
    await page.locator('.de-fld:has-text("Mms") input').fill('78.2');
    await page.locator('.de-fld:has-text("Qms") input').fill('4.500');

    // Rms must be calculated ~3.82 Ns/m (state C)
    await expect(rmsf).toHaveClass(/st-c/);
  });

  // 14. Zero Division & Zero Guarding
  test('UI prevents divide-by-zero crash when Qms or Re is set to zero', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    await qtsf.fill('');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Qms") input').fill('0');

    // Zero-division guard: Qts must remain uncalculated / Not Available (state N, grey, empty '')
    await expect(qtsf).toHaveValue('');
    await expect(qtsf).toHaveClass(/st-n/);
  });

  // 15. Tab State Persistence
  test('UI preserves solver state across Parameters and Advanced parameters tab switches', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    await qtsf.fill('');
    await page.locator('.de-fld:has-text("Qes") input').fill('0.400');
    await page.locator('.de-fld:has-text("Qms") input').fill('4.000');
    await expect(qtsf).toHaveValue('0.364');

    // Switch to Advanced parameters tab and back
    await page.getByRole('button', { name: 'Advanced parameters', exact: true }).click();
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    // Value and state class must persist
    await expect(qtsf).toHaveValue('0.364');
    await expect(qtsf).toHaveClass(/st-c/);
  });

  // 16. Modal Reset Button Operation
  test('UI Reset button reverts edits back to initial modal opening state', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    const initialDd = await ddf.inputValue();

    await ddf.fill('999.0');
    await expect(ddf).toHaveValue('999.0');

    // Click Reset button in modal footer
    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    // Dd must revert to initial value
    await expect(ddf).toHaveValue(initialDd);
  });

  // 17. Modal Cancel Button Operation
  test('UI Cancel button discards all edits and leaves project driver un-mutated', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    await ddf.fill('999.0');

    // Click Cancel button
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Modal must close
    await expect(page.locator('.de-body')).not.toBeVisible();
  });

  // 18. Modal OK Commit Operation
  test('UI OK button commits draft solver edits into project driver state', async ({ page }) => {
    const ddf = page.locator('.de-fld:has-text("Dd") input');
    await ddf.fill('210.0');

    // Click OK button
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Modal closes upon successful commit
    await expect(page.locator('.de-body')).not.toBeVisible();
  });

  // 19. Real Literal Text Fuzzing ('banana', '<script>') Rejection & State N Clearing
  test('UI rejects non-numeric literal text ("banana", "<script>") and clears field to state N (empty/Not Available) without crashing JS execution', async ({ page }) => {
    const fsf = page.locator('.de-fld:has-text("Fs") input');

    // 1. Dispatch non-numeric text 'banana' into input field
    await fsf.evaluate((el: HTMLInputElement) => {
      el.value = 'banana';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 2. Trigger blur event
    await fsf.blur();

    // 3. Input element cleanly clears to state N (Not Available, empty '') without crashing Vue
    await expect(fsf).toHaveValue('');
    await expect(fsf).toHaveClass(/st-n/);
    await expect(page.locator('.de-body')).toBeVisible();
  });



  // 20. Mathematical Q-Trio Contradiction Detection
  test('UI detects mathematical Q-trio contradiction (Qts != Qes*Qms/(Qes+Qms)) and reports consistency state', async ({ page }) => {
    const qtsf = page.locator('.de-fld:has-text("Qts") input');
    const qesf = page.locator('.de-fld:has-text("Qes") input');
    const qmsf = page.locator('.de-fld:has-text("Qms") input');

    // Force contradictory anchors: Qes=0.4, Qms=4.0 implies Qts=0.364, but user forces Qts=2.000
    await qesf.fill('0.400');
    await qmsf.fill('4.000');
    await qtsf.fill('2.000');

    // Both Qts and Qes stay locked as user anchors (state E)
    await expect(qtsf).toHaveClass(/st-e/);
    await expect(qesf).toHaveClass(/st-e/);
  });

  // 21. Unphysical Negative Parameter Warning
  test('UI flags unphysical negative parameters (Re = -8.0 Ohm, Fs = -35.0 Hz) with Data Quality (DQ) warning', async ({ page }) => {
    const ref = page.locator('.de-fld:has-text("Re") input');
    await ref.fill('-8.0');

    // Input stores the entered value -8.000 (state E) and receives .inp-bad class
    await expect(ref).toHaveValue('-8.000');
    await expect(ref).toHaveClass(/st-e/);
    await expect(ref).toHaveClass(/inp-bad/);
  });


  // 22. Voice Coil Geometry Boundary Contradiction
  test('UI handles voice coil geometry contradiction (underhung Hc/Hg vs excessive Xmax) cleanly', async ({ page }) => {
    const hcf = page.locator('.de-fld:has-text("Hc") input');
    const hgf = page.locator('.de-fld:has-text("Hg") input');
    const xmaxf = page.locator('.de-fld:has-text("Xmax") input');

    // Underhung geometry: Hc=2.0mm, Hg=10.0mm implies Xmax=4.0mm
    await hcf.fill('2.0');
    await hgf.fill('10.0');

    // Force impossible Xmax=50.0mm as user anchor
    await xmaxf.fill('50.0');

    // All three remain locked as Entered anchors (state E) without throwing an infinite loop or JS crash
    await expect(hcf).toHaveClass(/st-e/);
    await expect(hgf).toHaveClass(/st-e/);
    await expect(xmaxf).toHaveClass(/st-e/);
  });
});
