import os
import glob
import re

directories = ['packages/design', 'packages/ui', 'packages/persistence', 'packages/model']

def replace_in_file(filepath):
    if not filepath.endswith('.ts') and not filepath.endswith('.vue'):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    orig_content = content

    # 1. conformingRecordToOpenIsdDriver -> OpenISDDriver.fromConformingRecord
    # First, handle imports: we might need to remove it from imports, and ensure OpenISDDriver is imported.
    # Actually, in most cases, they import { conformingRecordToOpenIsdDriver, OpenISDDriver } or similar.
    # It's easier to just do a string replacement for the function call, then rely on tsc/eslint to fix imports,
    # OR we can manually try to clean up imports if we want to be nice. But just doing string replacement of the call works.
    
    # Wait, if we just replace the call `conformingRecordToOpenIsdDriver(` with `OpenISDDriver.fromConformingRecord(`, 
    # and they already import OpenISDDriver, it works. But they might not import OpenISDDriver!
    # Let's add OpenISDDriver to the import if it's missing but conformingRecordToOpenIsdDriver was there.

    # Function calls
    content = content.replace("conformingRecordToOpenIsdDriver(", "OpenISDDriver.fromConformingRecord(")
    content = content.replace("openIsdDriverYmlToOpenIsdDriver(", "OpenISDDriver.fromYml(")
    content = content.replace("conformingRecordToOpenIsdPassiveRadiatorStandalone(", "OpenISDPassiveRadiatorStandalone.fromConformingRecord(")
    content = content.replace("newProject(", "OpenISDProject.builder(")
    
    # For JSON/YAML (these might not be used outside of openisdTransforms but just in case)
    content = content.replace("openIsdDriverYmlToOpenIsdDeviceJson(", "OpenISDDeviceJson.fromOpenisdDriverYml(")
    content = content.replace("openIsdDeviceJsonToOpenIsdDriverYml(", "OpenISDDeviceJson.toOpenisdDriverYml(")

    # Fix imports (naive but often works)
    content = content.replace("conformingRecordToOpenIsdDriver,", "OpenISDDriver,")
    content = content.replace(", conformingRecordToOpenIsdDriver", ", OpenISDDriver")
    content = content.replace("{ conformingRecordToOpenIsdDriver }", "{ OpenISDDriver }")
    
    content = content.replace("openIsdDriverYmlToOpenIsdDriver,", "OpenISDDriver,")
    content = content.replace(", openIsdDriverYmlToOpenIsdDriver", ", OpenISDDriver")
    content = content.replace("{ openIsdDriverYmlToOpenIsdDriver }", "{ OpenISDDriver }")
    
    content = content.replace("conformingRecordToOpenIsdPassiveRadiatorStandalone,", "OpenISDPassiveRadiatorStandalone,")
    content = content.replace(", conformingRecordToOpenIsdPassiveRadiatorStandalone", ", OpenISDPassiveRadiatorStandalone")
    content = content.replace("{ conformingRecordToOpenIsdPassiveRadiatorStandalone }", "{ OpenISDPassiveRadiatorStandalone }")
    
    content = content.replace("newProject,", "OpenISDProject,")
    content = content.replace(", newProject", ", OpenISDProject")
    content = content.replace("{ newProject }", "{ OpenISDProject }")
    
    # Deduplicate OpenISDDriver if it was imported twice (e.g. `import { OpenISDDriver, OpenISDDriver }`)
    content = re.sub(r'OpenISDDriver\s*,\s*OpenISDDriver', 'OpenISDDriver', content)
    content = re.sub(r'OpenISDProject\s*,\s*OpenISDProject', 'OpenISDProject', content)
    
    # Also for type imports: `import { type OpenISDDriver, OpenISDDriver }`
    content = re.sub(r'type\s+OpenISDDriver\s*,\s*OpenISDDriver', 'OpenISDDriver', content)
    content = re.sub(r'type\s+OpenISDProject\s*,\s*OpenISDProject', 'OpenISDProject', content)

    if content != orig_content:
        with open(filepath, 'w') as f:
            f.write(content)

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            replace_in_file(os.path.join(root, file))

