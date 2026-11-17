# Phone Box tab: the Box type dropdown is wider than every box under it

Status: RESOLVED (T734, 8 Nov 2026): the dropdown ends where the number boxes end. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

John (chat, 8 Nov 2026): looks ok, leave it; T734 then made it match anyway.

On the phone Box tab the Box type dropdown is 260 px wide (right edge 358) and the number boxes under it are 160 or 170 px wide (right edge 258 or 268). Rule 4: one width and one right edge in a group.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
