# Desktop Advanced tab: air values differ in width

Status: OPEN. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

On the desktop Advanced tab Temperature, Relative humidity and Air pressure are 146 px wide and Sound velocity and Air density are 134 px wide, in one column. Rule 4: one width in a group.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
