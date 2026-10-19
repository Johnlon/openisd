# BUG_20261017_auto-y-overlaps-first-frequency-label

**Status:** OPEN (owner maryu, waiting on a layout choice from fable)

## Symptom
In the same screenshot as the title bug (phone Graph tab, Tune sheet open): the "Auto Y" box in the chart's
bottom-left corner is drawn over the first frequency label (10).

## Cause
Auto Y is 43 px wide from 2 px in. The first frequency label is centred on the plot's left edge (44 px), so it
starts at about 39 px.

## Choices
- Skip the frequency label that would fall under Auto Y (loses "10" while Auto Y shows).
- Move Auto Y to the title row, after the title (the top-right corner holds the cursor readout).
- Make the bottom margin tall enough to put Auto Y under the frequency labels (costs about 14 px of plot).

## Question for John (19 Oct 2026, worker E)
Not fixed in the 19 Oct wave: each of the three choices changes what the chart shows (a lost "10" label, Auto Y moved to the title row, or 14 px less plot). Which one?
Recommendation: move Auto Y to the title row after the title; nothing is lost and the plot keeps its height.
