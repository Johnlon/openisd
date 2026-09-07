import re

with open('packages/design/domain/openisdTransforms.ts', 'r') as f:
    content = f.read()

# We want to keep everything from driverSectionProblems downwards, but make them exported, 
# and also export the ProjectBuilder classes.
# The top part of the file should just be imports.

replacement = """// Conversion utilities mapping unvalidated input -> domain classes -> project states.
// These only depend on public methods from `openisdDomain.ts` and schemas from `openisdSchema.ts`.
// Layout: exported functions -> private helpers -> builder classes.

import {
    emptyBoxJson,
    type OpenISDDeviceJson,
    type OpenISDBoxJson,
    type OpenISDProjectJson,
} from './openisdSchema.js';
import {
    OpenISDDriver,
    OpenISDPassiveRadiatorStandalone,
    OpenISDProject,
} from './openisdDomain.js';
import {Engine} from '../engine/index.js';

// ── VALIDATION HELPERS — private to this file ──────────────────────────────────────────────

/**
 * The ONE wording for the shape both seams refuse identically. A caller that asks both seams and
 * merges their findings de-duplicates by value, so two paraphrases of this one condition reach a
 * reader as two separate complaints about the same record.
 */
const TWO_THINGS_AT_ONCE = 'both a driver section and a passive-radiator section — this record is two things at once';

export function driverSectionProblems(json: OpenISDDeviceJson): string[] {
"""

# Replace everything up to `function driverSectionProblems` with our clean string
content = re.sub(r'^.*?function driverSectionProblems', replacement, content, flags=re.DOTALL)

# Make sure radiatorSectionProblems and ProjectBuilder are exported
content = content.replace("function radiatorSectionProblems", "export function radiatorSectionProblems")
content = content.replace("class ProjectBuilder", "export class ProjectBuilder")
content = content.replace("class BoxProjectBuilder", "export class BoxProjectBuilder")

with open('packages/design/domain/openisdTransforms.ts', 'w') as f:
    f.write(content)
