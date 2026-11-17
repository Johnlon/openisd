# Phone Driver editor Parameters: the Connection pick list is 217 px, the number boxes 127 px

Status: OPEN. Found by T742 when `field-layout-rules.browser.spec.ts` first opened the Edit driver popup at 374 x 705, 10 Nov 2026.

On the Parameters tab the Connection pick list is 217 px wide and every number box above it is 127 px, all in one column. Rule 4: one width in a group.

The gate lists this as a known fault (`phone Driver editor Parameters`, R4) and turns red when it is fixed; then delete the entry in KNOWN.
