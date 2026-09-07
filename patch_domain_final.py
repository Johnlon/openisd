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
if "fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver" not in content:
    content = content.replace("export abstract class OpenISDDriver extends OpenISDDevice {", "export abstract class OpenISDDriver extends OpenISDDevice {" + driver_add)

project_add = """
    static builder(driver: OpenISDDriver, engine: Engine): ProjectBuilder {
        return new ProjectBuilder(driver, engine);
    }
"""
if "static builder(driver: OpenISDDriver, engine: Engine): ProjectBuilder" not in content:
    content = content.replace("export class OpenISDProject {", "export class OpenISDProject {" + project_add)

pr_add = """
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const sectionProblems = radiatorSectionProblems(conformed.json);
        if (sectionProblems.length > 0) return sectionProblems;
        return OpenISDPassiveRadiatorStandalone.wrap(conformed.json, engine);
    }
"""
if "static fromConformingRecord(record: unknown, engine: Engine): OpenISDPassiveRadiatorStandalone" not in content:
    content = content.replace("export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {", "export class OpenISDPassiveRadiatorStandalone extends OpenISDPassiveRadiator {" + pr_add)

with open('packages/design/domain/openisdDomain.ts', 'w') as f:
    f.write(content)
