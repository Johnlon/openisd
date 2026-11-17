# ABC hint text cut off at the bottom of the Box notes column

Status: FIXED by T715, 8 Nov 2026.

On the desktop skin at 1366x768, the Box tab notes column (right of the diagram) is as tall as the fields beside it (148 px) while the tab has 229 px. For an ABC project the notes need 165 px, so the last line of the ABC hint ("chambers.") is hidden and the column scrolls inside. It was already so on main before T715. At 1920x1080 it fits.

Fix: the Box row fills the tab height, so the notes column has the room (`.box-tab-row { min-height:100% }`). Test: `original-shell-layout.browser.spec.ts`, "Box notes column shows every hint in full".
