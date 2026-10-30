# Driver and Signal numeric boxes differ from Filters

27 October2026, T607. John reports inconsistent field widths across Driver, Signal and Filters.

At the same374px phone viewport, Driver readonly boxes and short dropdowns and Signal
numeric inputs measured170px. Allpass numeric boxes measured134px. The shared grid used
each container's leftover width: filter-card borders/insets and the optional model-cue
rail took more room. Existing overlap/border tests allowed either width when glyphs fit;
they did not compare equivalent controls across pages.

The optional question asking whether to narrow Driver/Signal or widen Filters has not been
answered. Following John's earlier preference for narrower boxes, the preview uses the
existing narrower Filters budget. This is a stated implementation assumption, not a new
use-case approval. Card indentation remains. No broad audit is resumed.

New DOM TDD checks compare every numeric box and Driver short dropdown across the three
pages. All three viewport cases fail before the change (red125251). One common responsive
budget, including possible card insets and model cue, gives120px at360px,134px at374px
and190px at430px. The contract ignores readonly/editable, units, spinners and presence of
a particular cue when choosing the common width. A wide filter-family dropdown remains
wide for its longer selected names.

Three width cases plus14 existing joined-field checks pass125413. They check glyph/label
clearance, visible borders and common widths. Existing single Driver production-width
assertion now expects134px for this explicit narrower-width request; it still enforces
grey surface, native readonly protection and production Inter typography. No test is
skipped/deleted. Row heights, font sizes, labels and values are preserved.

Same-project production/before/after phone evidence:
http://lap:8000/winisd/openisd-t607/build/ui-contract/field-consistency-v1/
Every picture has its own comment composer. Current pictures were personally compared
against before and production. Driver/Signal narrowing is beneficial for consistent
control sizing and the user's narrower-box preference; Allpass is visually unchanged.
Production-only cloud/banner, prior Info addition and earlier field/cue restoration
predate this change and are disclosed, not claimed as new improvements.

Gemini first review identified that equal widths still left Driver/Signal fields13px
left of the card fields. New edge equality assertion red131054 catches this. Unframed
rows now gain13px of label-column space (wording/font unchanged), putting all controls
atx111..245px at374px viewport, and spinners atx245..335px. The remaining right rail
is available for external model cues. Existing Filter cards and their indentation remain.
All17final width/touch cases pass131158; strict lint131204 and typecheck131319 pass.

Gemini's proposed Connection option "Series / parallel" does not exist: the actual
ARRAY_WIRING_OPTIONS contains only Parallel and Series (options.ts36-39). Existing
Driver inventory tests bind the actual options. No fictional option was added or
truncate warning disguised as a known defect. Wider future option labels will need
their own conformance checks; the general field-content helper currently omits .mob-crow.

Preview is a complete production-mode bundle at http://lap:4607/, build/field-consistency-preview-v4.
Persistent-profile startup restored the saved project in1421ms,15requests,no errors/dev imports.
No landing/deployment or exhaustive standards audit is claimed.
