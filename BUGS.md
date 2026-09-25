# Known bugs

## Verified open (2026-09-25)

| Behaviour                                                                                             | Record                                                                                              |
|-------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Voice-coil inductance changes the impedance curve but not the SPL curve.                              | [voice-coil-inductance](bugs/BUG_20260924_voice-coil-inductance-affects-impedance-but-not-spl.md)   |
| Raising sealed-box leakage lowers low-frequency phase and group delay; in WinISD it raises them.     | [sealed-box-leakage](bugs/BUG_20260924_sealed-box-leakage-modelled-as-damping-not-a-leak.md)        |
| The driver solve and the sweep use different air models when the project states none.               | [air-models](bugs/BUG_20260924_driver-solve-and-sweep-use-different-air-models.md)                  |
| The transfer-function chart's 0 dB reference differs from the sweep's passband SPL.                  | [tfmag-reference](bugs/BUG_20260924_tfmag-reference-disagrees-with-own-passband-spl.md)             |

## Not yet re-verified

[`bugs/`](bugs/) holds 74 further records whose status is not resolved. They were written between
2026-08-13 and 2026-09-16, and many describe code that has since been rewritten. Each needs
checking against the current code before it is listed above or closed.
