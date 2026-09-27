import type { DqIssue } from '../../engine/index.js';

/** The vent tuning↔length pair and the PR addedMass↔tuning quad each carry ONE relation between
 *  a small, tightly-coupled group of quantities — unlike the driver's 44 largely-independent
 *  fields, an issue anywhere in the group redlines EVERY field in it, not just the ones
 *  `issueFields()` happens to name (the established "redline all the fields" ruling PR's own
 *  handles already carried before S2-7d2 — see the type's own doc comment). Takes the FIRST
 *  issue only, matching what every hand-wrapped predecessor field did (`issues.find(...)`) —
 *  these groups practically never carry more than one live issue at once. */
export function groupDq(issues: readonly DqIssue[]): readonly DqIssue[] {
    return issues.length > 0 ? [issues[0]] : [];
}
