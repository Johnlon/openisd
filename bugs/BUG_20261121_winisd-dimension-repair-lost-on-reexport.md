# Repaired driver dimensions became zero on the second WinISD export

The proposed dimension load repair wrote fallback values with WinISD state `C`. A `.wdr` import discards `C` values and asks the engine to derive them from the supplied inputs. If the inputs could not determine the dimensions, the second export wrote Depth, MagDepth and Magnet as `0` with state `N`.

A driver file with `Depth=12`, `MagDepth=13` and `Magnet=14` metres reproduces the loss. The first export wrote each as `0.00001` and the second wrote each as `0`.

An interim repair stored the fallback with state `E` so it survived further exports. John ruled on 21 November 2026 that “WinISD file's basket is read exactly as WinISD's format states it, never squashed” and the “same applies to owdr and Owpr files”. The domain now keeps supplied dimensions and flags out-of-range values.

The [two-export regression test](../packages/design/test/domain/driver-dimensions-load-repair.test.ts) checks that the original `12`, `13` and `14` values keep their `E` marks through two exports.
