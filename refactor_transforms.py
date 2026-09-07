import re

with open('packages/design/domain/openisdTransforms.ts', 'r') as f:
    content = f.read()

# I will use simple string replacement since I know the exact boundaries.
content = re.sub(r'export function conformingRecordToOpenIsdDriver.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'export function openIsdDriverYmlToOpenIsdDriver.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'export function conformingRecordToOpenIsdPassiveRadiatorStandalone.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'export function openIsdDriverYmlToOpenIsdDeviceJson.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'export function openIsdDeviceJsonToOpenIsdDriverYml.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'export function newProject.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'function conformingRecordToOpenIsdDeviceJson.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'function stripDriverYmlOnlyFields.*?\}\n', '', content, flags=re.DOTALL)
content = re.sub(r'const TWO_THINGS_AT_ONCE =.*?once\';\n', '', content, flags=re.DOTALL)

with open('packages/design/domain/openisdTransforms.ts', 'w') as f:
    f.write(content)
