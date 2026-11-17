# Desktop splitter buttons are cut off when the left panel or bottom section is hidden

Status: OPEN (T745). Found by maryu in the expansions audit, 8 Nov 2026; John ruled it a bug to fix (QO467.c1).

There are two splitter buttons, the left panel's and the bottom section's. Each is 15 px across on a 7 px splitter, so it sticks 4 px out each side. When the left panel is hidden its splitter sits at the window's left edge and the button starts at x −4; when the bottom section is hidden its splitter sits at the window's bottom and the button ends 4 px below the visible area. We need each button to stay whole inside the window when its panel is hidden.

Test: `packages/ui/test/ui/original-shell-layout.browser.spec.ts`, "a hidden panel's splitter button shows whole".
