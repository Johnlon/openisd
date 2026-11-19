# BUG_20261118_impedance-auto-y-floor-at-1-ohm

**Status:** FIXED by T903 (the change that lets the Impedance chart's Auto Y range go below 1 ohm).

## Symptom
Impedance chart, Auto Y ticked: the Y axis never went below 1.0 ohm, so a curve with lower values ran off the bottom of the chart. Seen on test.openisd.app v20261118T1807Z with the Tang Band W5-1138SMF in a closed 4.48 L box and 4 drivers: the impedance falls below 1 ohm under ~45 Hz and over ~200 Hz and was cut off. The axis showed only a "1.0" label.

## Cause
`packages/design/chart/series.ts`, the `Zmag` curve builder: `ymin: Math.max(1, Math.min(...sw.zmag) * 0.9)`. The `Math.max(1, ...)` pinned the floor at 1 ohm. Four drivers wired in parallel (the default) divide the impedance by four, so the curve sits below 1 ohm. The log axis's labels were only on whole decades, so an axis from 1 to under 10 had the single label "1.0".

## Fix
The floor is 10 % below the lowest point (`Math.min(...sw.zmag) * 0.9`). `LevelAxis.ticks` on a log axis showing under two decades labels every 1-2-5 tick. Other charts checked: none has a floor above its data (MaxPwr already follows its data down; the zero floors of Excursion, GD, VA stay because the data there is not negative). A unit test checks, for every sealed-box chart with 1 and with 4 drivers, that every finite point of the main trace lies inside the axis.
