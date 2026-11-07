# The desktop vent count is still a hand-built dropdown

Status: REOPENED 6 Nov 2026. John ruled the desktop port columns stay as the test site serves them for this release, so the common-field count is not landing; it is on the local branch `t690-port-row`. The architecture gate lists OriginalShell.vue as staying hand-built until then. Earlier status: FIXED by option B of QO426 (own commit, easy to revert if John picks A). John, 5 Nov 2026: "ALL SCREENS USE THE COMMON COMPONENT". Task T690.

There are two vent-count controls on the desktop, the common field (`UIFixedField` over `UIFieldBody`) and the hand-built `<select>` in `OriginalShell.vue` (the port column of the bottom panel). Every other count dropdown now uses the common field; this one does not, and the architecture gate `no-numinput-outside-uifieldbody.test.ts` is red on it.

Why it was not moved: the port column is a fixed grid (`.port-columns`, 257 px + the 135 px right-hand cell where Shape and Number of vents sit side by side). The common field is 150 px label plus about 120 px box, so in that cell it is 48 px too wide: the ABC panel overflows by 48 px and seven layout specs fail (original-field-regions, original-bandpass-vents, original-shell-layout). Putting it in the left column instead adds one row, about 22 px, to every port column, and the bottom panel has a fixed height.

Decision needed from John: widen the port column by about 48 px, or add the row (22 px taller panel). Either changes the desktop bottom panel layout.

Done: the desktop vent count is `UIFixedField` over `UIFieldBody` on its own row in the left column of each port column; the bottom panel minimum height is 273 px (was 244; slotted ports need the extra row), so the chart above is 29 px shorter. No per-screen size CSS on the count. Measured at 1280x720 on ABC, 6th-order bandpass and vented: count box 93x28, nothing clips, overlaps or scrolls. Option A (widen the column by about 48 px) clipped the last count and overlapped fields.
