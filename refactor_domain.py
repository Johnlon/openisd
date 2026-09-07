import re

with open('packages/design/domain/openisdDomain.ts', 'r') as f:
    content = f.read()

driver_add = """
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const sectionProblems = driverSectionProblems(conformed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDDriverStandalone.wrap(conformed.json, engine);
    }

    static fromYml(text: string, engine: Engine): OpenISDDriver | string[] {
        const parsed = OpenISDDeviceJson.fromOpenisdDriverYml(text);
        if ('problems' in parsed) return parsed.problems;

        const sectionProblems = driverSectionProblems(parsed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDDriverStandalone.wrap(parsed.json, engine);
    }
"""

pr_add = """
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const sectionProblems = radiatorSectionProblems(conformed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDPassiveRadiatorStandalone.wrap(conformed.json, engine);
    }
"""

project_add = """
    static builder(driver: OpenISDDriver, engine: Engine): ProjectBuilder {
        return new ProjectBuilder(driver, engine);
    }
"""

# Import OpenISDDeviceJson and driverSectionProblems, radiatorSectionProblems, ProjectBuilder
imports = """
import { OpenISDDeviceJson } from './openisdSchema.js';
import { driverSectionProblems, radiatorSectionProblems, ProjectBuilder } from './openisdTransforms.js';
"""
content = imports + content

# Add to OpenISDDriver class
content = content.replace(
    "class OpenISDDriver {",
    "class OpenISDDriver {" + driver_add
)

# Add to OpenISDPassiveRadiatorStandalone class
content = content.replace(
    "class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {",
    "class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {" + pr_add
)

# Add to OpenISDProject class
content = content.replace(
    "class OpenISDProject {",
    "class OpenISDProject {" + project_add
)

with open('packages/design/domain/openisdDomain.ts', 'w') as f:
    f.write(content)
