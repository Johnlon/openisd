# A typed driver Cms, Mms or Rms is ignored by the charts (found 8 Nov 2026, QO463.c62)

Symptom: on a driver with Fs, Qes, Qms, Re, Sd, BL, Mms and Cms typed, typing Vas moves the SPL curve; typing Cms moves nothing. The box shows the typed Cms but no chart reads it.
Cause: `DriverEngine.circuitValues`, called by `SimulationEngine.sweep`, works Cms out from Vas and Sd, Mms from Fs and that Cms, Rms from Fs, Mms and Qms, and BL from Re, Fs, Qes and that Cms, before every sweep. This is how WinISD builds its simulation (decompile fr_45e090). The driver has no "typed last wins" rule; the radiator has it since T732 (0f1e8963c).
Ruled (QO463, QO472): the driver and the radiator both follow one rule.
- A typed Cms moves the charts. Typing Cms drops the entered Vas, and typing Vas drops the entered Cms (typed last wins); the dropped one is worked out again.
- WinISD does not: its editor keeps Vas as entered (E) when Cms is typed and recalculates Rms (probe: winisd_research/runs/cms_mms_rms_bl_edit_e150he, cms.json), and its charts ignore the typed Cms.
- A datasheet that states both Cms and Vas and they disagree: the option "Cms from Vas" (ticked by default, WinISD's way) decides which the charts use.
- The saved record keeps the datasheet Cms, Mms and Rms as entered (E). The box shows the figure the charts use, marked C, and its warning popup gives the datasheet value: "Datasheet Cms is 0.60 mm/N. It does not agree with Vas, so the charts use 1.19 mm/N, worked out from Vas. Untick Cms from Vas to use the datasheet value."
- WinISD's editor shows the stated Mms, Cms and Rms as E, though its own charts do not use them; OpenISD shows what the charts use. Row in docs/research/WINISD_PARITY.md.
Tests: test/domain/cms-from-vas.test.ts (the rule), driver-edit-parity-e150he-44 and -w5 (saved E, shown C, typed Cms asserted, not it.fails).
