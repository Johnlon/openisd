# Box losses labels and missing popup audit coverage

Reported by John after the joined-field restoration: Interchamber Qicl disappears under
the input. The required repair is more label space and a narrower value field on this
screen. Related Absorption Qa also wraps with the default82px phone label rail.

The earlier screen registry visits project tabs and wizard steps but never opens the
Box losses sheet/modal. Functional popup tests check label existence and editability,
which do not prove visibility, no covering controls, or fit against ancestors.

New DOM layout red:20261027-114955-3362083.log reproduces the long labels failing to fit
on one line on bandpass6 Rear at374px. The fix selects the existing128px label-column
contract for all phone losses fields, leaving the adjoining value boxes narrower. No
units, values, settling defaults, outside-cue positions or spinner behaviour change.

The expanded audit covers both skins, all6 box types, every applicable chamber, phone
360/374 and desktop1024/1280. Its coverage ledger is docs/design/T607-surface-audit.md.
Other tabs, overlays and popups must be inventoried and audited explicitly, not inferred
from main-page results. Production/before/after images are being recorded separately.


Verified local repair:55 layout/behaviour cases115046,28 domain/hook cases115914,
typecheck115909 and strict changed-file lint115915. At374px the input narrows167→121px
while its right edge and spinners stay fixed. Same-project production/before/after
pictures are published with per-picture comments; CORRECTED appears first. The source
change affects only four phone losses rows. John cancelled the all-surface audit (“forget my comments about broard context”); only the popup repair remains in scope.
The served preview is the full bundle build/surface-audit-preview-v1; no dev modules.

Gemini independently compared production/before/after phone pictures and the local
source. It confirms no label wraps, truncates or is obscured, the font and weight stay
the same, the input narrows167→121px, and right edges/spinners, row/sheet height and
footer remain unchanged. Report: build/ui-contract/surface-audit-v1/qicl/argon-review.json.
