# Desktop New Project wizard: the info button's "i" sits in the button's bottom-right corner

**Status:** CLOSED, fixed: checked on main 8 Nov 2026, glyph centred. Closed by John on QO456, 8 Nov 2026.

Status: FIXED in T690. Found by T690's vision check (picture 06), 5 Nov 2026. Also on main.

On the desktop New Project wizard, step 2, the round "i" next to "Iso-Barik (not modelled)" is drawn in the bottom-right corner of its 28 px square button, touching the button's right and bottom borders, instead of centred. Cause: the shared info button is centred by a rule scoped to the phone wizard only; the desktop wizard only sets its size.

Test: `packages/ui/test/ui/new-project-wizard-selects.browser.spec.ts`, "the info glyph is centred in its button".
