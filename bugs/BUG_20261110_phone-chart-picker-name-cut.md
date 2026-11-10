# Phone Graph: the chart picker cuts a long chart name to fit (15 of 22 charts)

Status: OPEN. Found by T763 (`view-layout-walk.browser.spec.ts`) on 10 Nov 2026, 374 x 705.

The chart picker button (`.mob-chart-pick-label`) is too narrow for 15 chart names, for example "Transfer function" is cut by 85 px and "Amplifier apparent power" by 130 px, so the user cannot read which chart is open. We need the whole name shown (shorter names or a wider button).

The walk lists these 15 as known faults (`phone chart-<id>`, W3) and each turns red when its name fits; then delete the entry in KNOWN.
