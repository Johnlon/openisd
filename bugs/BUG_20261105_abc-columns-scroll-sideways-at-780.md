# ABC vent columns scroll sideways at a narrow desktop window

Status: OPEN. Found by T671, 5 Nov 2026.

At a desktop window 780 px wide, the ABC Vents pane is 447 px wide. The three port columns keep their 262 px minimum, so the pane scrolls sideways. Narrowing them to about 149 px each puts the value boxes over the labels (`original-field-regions.browser.spec.ts`).

T671 fixes 1024 px, where the pane is 691 px. Below a 660 px pane the behaviour is unchanged from before T671.

Fix: at this width the columns must stack or wrap so nothing scrolls sideways. The layout is John's to see first.
