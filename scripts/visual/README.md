# Visual change page

After a landing changes visual baselines, `publish-changes.sh <task> <base> <head>` writes a before/after page
for John (`diff-page.mjs` builds it, `scripts/feedback/feedback-page.py` renders it,
`scripts/feedback/mark-diff.py` draws the red boxes).

## Grouping rule

- Pairs that show the same change are one group. "Same change" = mark-diff's changed boxes (`--print-box`)
  have the same position and size within 8 px (`BOX_TOLERANCE` in `diff-page.mjs`), compared to the group's first pair.
- A pair with no box (new screen, removed screen, no visible difference, change fills the picture) is its own group.
- A group shows its first pair, with its own "Look at:" line saying how many more pictures show the same change.
- The other pairs of the group sit in a closed fold under it: "Same change in N more pictures (show)".
  A group of one has no fold.
- Every picture, folded or not, keeps its OWN comment box and its own "Look at:" line. The fold only hides; it never drops a picture.

## How it is written

`index.md` has an optional sixth column, "Same as": the name of the group's first pair. The page template
(`feedback-page.template.html`) renders rows that name a leader inside the leader's fold.

## Tests

`bash scripts/land/test/visual-page.test.sh`, `scripts/feedback/feedback_page_test.py`.
