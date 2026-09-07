import re

with open('packages/design/domain/index.ts', 'r') as f:
    content = f.read()

# Change export type { OpenISDDriver } to export { OpenISDDriver }
content = re.sub(
    r'export type \{\n  OpenISDDriver,\n\} from \'\./openisdDomain\.js\';',
    "export { OpenISDDriver } from './openisdDomain.js';",
    content
)

# Add OpenISDDeviceJson and OpenISDProject and OpenISDPassiveRadiatorStandalone to exports
content = content.replace(
    "export type { OpenISDProject } from './openisdDomain.js';",
    "export { OpenISDProject, OpenISDPassiveRadiatorStandalone } from './openisdDomain.js';"
)
content = content.replace(
    "export type { OpenISDDeviceJson, OpenISDBoxJson, OpenISDProjectJson } from './openisdSchema.js';",
    "export type { OpenISDDeviceJson, OpenISDBoxJson, OpenISDProjectJson } from './openisdSchema.js';\nexport { OpenISDDeviceJson as OpenISDDeviceJsonNamespace } from './openisdSchema.js';"
) # wait, openisdSchema doesn't export OpenISDDeviceJson type from index.ts, it's explicitly absent.

# Delete the old exported functions block
block_to_delete = """export {
  newProject,
  conformingRecordToOpenIsdDriver,
  conformingRecordToOpenIsdPassiveRadiatorStandalone,
  openIsdDriverYmlToOpenIsdDriver,
} from './openisdTransforms.js';"""
content = content.replace(block_to_delete, "")

with open('packages/design/domain/index.ts', 'w') as f:
    f.write(content)
