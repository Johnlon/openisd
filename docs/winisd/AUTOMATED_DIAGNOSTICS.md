# Automated WinISD Parity Diagnostics

This document outlines the automated testing and diagnostic methodology used to analyze calculation differences and resolve discrepancies between OpenISD and classic WinISD (running under Wine).

## Overview

Classic WinISD is a closed-source Delphi application. Guessing its internal physics formulas or state machine behaviors leads to conjecture. Instead, we use an **automated WSL-to-Wine interface** to programmatically manipulate WinISD, run targeted parameter sweeps, and extract calculated values directly from active controls and output files.

The automation harness is located under `winisd_research/` (outside the `openisd` repository root).

## Key Capabilities

1. **Keystroke Simulation (`SendInput`):** We type values directly into WinISD's controls, which fires its internal `OnChange`/`OnExit` validation loops and recalculates its state (avoiding crashes caused by `WM_SETTEXT` on VCL controls under Wine).
2. **Project Synchronization (`save_and_read`):** WinISD writes project parameters to `.wpr` (XML/INI) files with full double-precision floating-point accuracy. We trigger WinISD's "Save" action programmatically and read back the recalculated internal state from the `.wpr` file.
3. **Driver Editor Control (`DriverEditor`):** We programmatically click buttons, select tabs, and read entered/calculated color marks (`E` / `C` / `N`) from the editor's swatches using client-relative pixel color analysis.

---

## Practical Diagnostic Patterns

### 1. Resonance Frequency ($F_{sc}$) and Lossy Box Verification
To isolate whether a calculation discrepancy (e.g., $F_{sc}$) is caused by physical parameters ($V_{as}$ solver loops), environmental conditions ($T$, $p$), or acoustic losses ($Q_L$, $Q_a$), use the **parameter isolation method**:

1. Write a simple dummy `.wpr` file with a single-voice-coil driver of known parameters ($Fs=40\text{ Hz}$, $Vas=10\text{ L}$, $Vb=10\text{ L}$).
2. Load it in WinISD using the Wine harness.
3. Perturb parameters one at a time:
   - **Lossless Box:** Set `Qlr=10000` (leakage), `Qar=10000` (absorption). WinISD calculates $F_{sc} = 56.57\text{ Hz}$ (exactly matching the theoretical $F_s\sqrt{1+Vas/Vb} = 40\sqrt{2} = 56.57\text{ Hz}$).
   - **Lossy Box (Leakage only):** Set `Qlr=10`, `Qar=10000`. WinISD calculates $F_{sc} = 59.16\text{ Hz}$.
   - **Lossy Box (Absorption only):** Set `Qlr=10000`, `Qar=10`. WinISD calculates $F_{sc} = 56.57\text{ Hz}$.
4. **Conclusion:** Box absorption ($Q_a$) does not shift resonance, but box leakage ($Q_L$) acts as a physical leak (acoustic mass in parallel with compliance), making the box stiffer at resonance and shifting $F_{sc}$ upward.

### 2. Dual Voice Coil (DVC) Connection Calibration
To check if voice coil wiring (Series vs. Parallel) changes electrical and mechanical parameters in WinISD:

1. Connect to the Driver Editor and select the **Parameters** tab.
2. Read baseline parameters under **Parallel** wiring ($Re = 6.6\ \Omega$, $BL = 9.8\text{ Tm}$).
3. Programmatically switch the connection dropdown to **Series**.
4. Read the updated values: $Re$ becomes $26.4\ \Omega$ ($6.6 \times 4$), and $BL$ becomes $19.6\text{ Tm}$ ($9.8 \times 2$).
5. **Conclusion:** WinISD multiplies/divides the active editor fields when switching connection. However, due to its save bug, it always exports `VCCon=1` (Parallel) to the `.wpr` project file.

### 3. UI Auto-Calculation Recalculation Trick
During manual or automated GUI testing, calculated fields (such as `Fsc` and `Qtc`) may freeze or fail to update when inputting values character-by-character (due to WinISD's input event timing issues). 
To guarantee that the UI forces recalculation of dependent values:
1. Select the input textbox using `click_hwnd(hwnd)`.
2. Clear the contents or select all.
3. Simulate a Ctrl+X (Cut) followed by a Ctrl+V (Paste) or type the full value in a single action. The transition triggers the VCL validation system immediately and updates the display values.

---

## Running the Diagnostics Harness

The diagnostic scripts run under Linux using `wine` and a local Python virtual environment containing `Pillow` (for pixel capture/cropping):

```bash
# Set up a Linux virtual environment
python3 -m venv /tmp/linux_venv
/tmp/linux_venv/bin/pip install Pillow

# Run a diagnostic campaign script
/tmp/linux_venv/bin/python3 winisd_research/scripts/verify_winisd_re_isolation.py
```

This automated framework ensures all parity assertions are backed by reproducible, objective measurements rather than speculation.
