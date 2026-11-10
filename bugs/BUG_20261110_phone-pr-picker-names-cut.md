# Phone passive radiator picker: the radiator names are cut (3 rows)

Status: OPEN. Found by T776 (`view-layout-walk.browser.spec.ts`, view `pr-picker`) on 10 Nov 2026, 374 x 705.

In Box, Passive radiator, Select PR, the list rows (`.pr-lib-name`) cut the names "Dayton Audio E…" (by 146 px and 134 px) and "Dayton Audio N…" (by 138 px), so the user cannot read which radiator a row is. We need the whole name shown (wrap it onto a second line).

The walk lists `phone pr-picker` as a known fault (W3) and it turns red when the names fit; then delete the entry in KNOWN.
