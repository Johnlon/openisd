import os
import glob
import re

directories = ['packages/design', 'packages/ui', 'packages/persistence', 'packages/model']

def fix_imports(content):
    # Fix `import { OpenISDDriver, type OpenISDDriver }`
    content = re.sub(r'{\s*OpenISDDriver\s*,\s*type\s*OpenISDDriver\s*}', '{ OpenISDDriver }', content)
    content = re.sub(r'{\s*type\s*OpenISDDriver\s*,\s*OpenISDDriver\s*}', '{ OpenISDDriver }', content)
    content = re.sub(r'{\s*OpenISDProject\s*,\s*type\s*OpenISDProject\s*}', '{ OpenISDProject }', content)
    content = re.sub(r'{\s*type\s*OpenISDProject\s*,\s*OpenISDProject\s*}', '{ OpenISDProject }', content)

    # Remove OpenISDDriver from type imports if it's imported as value
    # Simple heuristic: remove `OpenISDDriver,` from `import type` blocks if we also have `import { OpenISDDriver }`
    # Just remove duplicate words within an import statement:
    def deduplicate(m):
        words = re.findall(r'[A-Za-z0-9_]+', m.group(1))
        # Keep words that are not duplicates, except "type" which is special
        # But wait, it's easier to just remove duplicates.
        return m.group(0)

    # Let's fix specific files reported:
    return content

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            if not file.endswith('.ts') and not file.endswith('.vue'): continue
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            orig = content
            content = fix_imports(content)
            
            # Additional cleanups for specific files
            content = re.sub(r'import\s+{\s*OpenISDDriver\s*,\s*type\s*OpenISDDriver\s*}', 'import { OpenISDDriver }', content)
            content = re.sub(r'import\s+{\s*OpenISDDriver\s*,\s*type\s*OpenISDDriver\s*,\s*type\s*Cell\s*}', 'import { OpenISDDriver, type Cell }', content)
            content = re.sub(r'import\s+{\s*OpenISDDriver\s*,\s*type\s*OpenISDDriver\s*,\s*OpenISDPassiveRadiatorStandalone\s*,', 'import { OpenISDDriver, OpenISDPassiveRadiatorStandalone,', content)

            if orig != content:
                with open(filepath, 'w') as f:
                    f.write(content)

# Fix openisdDomain.ts where I failed to inject the methods
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
if "static fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver" not in content:
    content = content.replace("export abstract class OpenISDDriver {", "export abstract class OpenISDDriver {" + driver_add)

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
