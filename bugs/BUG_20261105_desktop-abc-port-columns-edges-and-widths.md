# Desktop ABC tab: Shape and End Correction do not line up with the other port boxes

Status: FIXED on t742 by the Round/Slotted port-shape toggle and port columns (gate KNOWN entry removed 10 Nov 2026). Found by T690's field layout rules gate, 6 Nov 2026.

On the desktop ABC tab, in each port column, the Shape dropdown starts further left than the number boxes (271 against 345) and is 85 px wide, and End Correction is 138 px wide against 93 px for the number boxes. Rules 3 and 4: one left edge and one width in a group.

This is how the test site serves the port columns (origin/main). John ruled it stays for this release (6 Nov 2026). The fixed layout (Number of ports with a Round/Slotted button, End Correction as wide as its longest option) is on the local branch `t690-port-row`.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
