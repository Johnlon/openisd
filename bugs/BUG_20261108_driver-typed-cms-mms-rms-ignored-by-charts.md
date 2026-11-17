# A typed driver Cms, Mms or Rms is ignored by the charts (found 8 Nov 2026, QO463.c62)

Symptom: on a driver with Fs, Qes, Qms, Re, Sd, BL, Mms and Cms typed, typing Vas moves the SPL curve; typing Cms moves nothing. The box shows the typed Cms but no chart reads it.
Cause: `DriverEngine.circuitValues`, called by `SimulationEngine.sweep`, works Cms out from Vas and Sd, Mms from Fs and that Cms, Rms from Fs, Mms and Qms, and BL from Re, Fs, Qes and that Cms, before every sweep. This is how WinISD builds its simulation (decompile fr_45e090). The driver has no "typed last wins" rule; the radiator has it since T732 (0f1e8963c).
Open: John to rule whether the driver gets the radiator's rule (QO463, reply yes or no); then a parity row if it differs from WinISD.
