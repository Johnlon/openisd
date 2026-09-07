import re

files_to_fix = [
    'packages/design/app/workspace.ts',
    'packages/design/domain/openisdDomain.ts',
    'packages/design/test/engine-wiring.test.ts',
    'packages/design/test/persistence.test.ts',
    'packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts',
    'packages/design/winisd/openIsdProjectToWinIsdProject.ts'
]

for filepath in files_to_fix:
    with open(filepath, 'r') as f:
        content = f.read()

    # OpenISDDeviceJson imported as type -> value
    content = content.replace("type OpenISDDeviceJson,", "OpenISDDeviceJson,")

    # newProject -> OpenISDProject.builder
    content = content.replace("ReturnType<typeof newProject>", "ReturnType<typeof OpenISDProject.builder>")

    # Clean up duplicate imports manually via regex since they can span lines
    content = re.sub(r'type\s+OpenISDProject\s*,', '', content)
    content = re.sub(r'type\s+OpenISDDriver\s*,', '', content)
    
    # Remove duplicates from the same block
    content = re.sub(r'\bOpenISDProject\b\s*,\s*\bOpenISDProject\b', 'OpenISDProject', content)
    content = re.sub(r'\bOpenISDDriver\b\s*,\s*\bOpenISDDriver\b', 'OpenISDDriver', content)

    with open(filepath, 'w') as f:
        f.write(content)

