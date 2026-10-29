# Commented gallery surfaces overlap

Status: fixed in local2346preview; final external critique completed.

John reported QO305.c49–c80 after inspecting the2049gallery. Desktop box chamber controls spill into neighbouring labels, tight two-chamber vents overlap across columns, PR column box widths differ, and the save rail consumes needed width. Losses/chart captures also show those same underlying pane failures. Phone Project description is narrow, alignment selector is indented, Options pressure text clips and storage counts do not align. Plot Window spinners differ. Driver dimensions must use the approved T418strong outline.

Existing shell overlap tests compare wrapper boxes, but descendants can paint outside a max-width-constrained wrapper. Clipping tests visit only ancestors with clipping overflow; they do not establish containment inside layout columns with visible overflow. New tests must measure painted controls/labels against owning fields and neighbouring columns. The current generic heading-bound test only visits the closed-box example in its caller.

Detailed repair queue and verification evidence: tasks/T607-progress.md.


Implemented2325: chamber236px tracks contain the complete label/box/spinner group; diagrams and narrower notes move with them. Compact vent captions retain their original11px/12px type, with the input/unit/spinner group in its own grid row; empty readout spinner tracks are dropped in that compact pane, so all three ABC groups fit1280. Banners use existing section-header paint. PR boxes share150px even with wide symbols, and added-mass resonance gets its own row. The repeated rail legend is removed, status joins the bottom legend, What-if sits at top, and Revert aligns right.

Phone description fills the available sheet body. Alignment selects share the numeric left edge. Options chooses the existing96px medium label profile for both text and numeric rows; clipped values now fit without changing precision or font size. Storage counts have a shared value column. Desktop Plot Window no longer forces20pxcontrols and inherits standard28pxspinners. The shared dimensions SVG copies the approved T418front-plate and two diagonal basket edges: dark#0f172a,2.5pxnon-scaling strokes.

Red/green evidence and bounded test counts are in the task log. Intermediate2325candidate checks caught a real panel-height/ABC-overflow regression; corrected with the existing dense caption scale and absent-track removal, preserving stable212pxpanel height. Final22layout-region contexts,3stability/standard-width cases and46Options cases pass. Required60baseline cases pass; authored lint/UItypes pass. Final capture publication and external review remain in progress.

Full mobile/desktop gallery is now rebuilt consistently on2325with507decodedimages, retaining production2233and original comment identities. Focused22-view comparisons include66production/before/after images. No unexpected capture failures remain after recovering the terminated preview as a managed service.

Final external review identified an end-correction text/arrow collision and avoidable storage/colour-label height. Fixed with compact descriptive options preserving all coefficients, compact2-column aligned storage, and wide Plot Window colour labels. Native text-space and3-width Options/scroll checks pass;62domain cases pass. Gemini final recheck finds no blockers in those5surfaces. A reported banner shortfall is disproved by the expanded actual header-bound check.

All gallery preview images now show2346and the document has509decodedimages; the added diagram detail frames explain its scroll coverage. Every existing per-picture comment identity is retained. No unexplained app calculation changes were introduced by these layout repairs.
