# Phone driver editor: a line is drawn across the selected tab

Status: FIXED — T418 round 3 (pending John's "go T418"). John, 20 Oct 2026, on the round 2 General picture: "the tab has a problem, it has a line across it".

## What is wrong

The tab strip has a 1 px line under it. The selected tab only hid that line by overhanging the strip by a fraction of a pixel (the tab's 44 px minimum height against a 43 px strip). Depending on pixel rounding, the line showed across the bottom of the selected tab: measured in the round 2 picture, a full-width 187-grey line directly under the General tab.

## Fix

The selected tab now sits over the strip's line on purpose (`margin-bottom: -1px`), so the line is never across it and still runs under the other tabs. A spec takes a screenshot of the tab's lower edge at 2.566 pixel density and checks that every pixel row across the tab is one colour.
