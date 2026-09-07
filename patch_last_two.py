import re

with open('packages/design/app/workspace.ts', 'r') as f:
    content = f.read()

# I need to add OpenISDDriver to the imports!
if 'import { OpenISDProject }' in content:
    content = content.replace('import { OpenISDProject }', 'import { OpenISDProject, OpenISDDriver }')
elif 'import { OpenISDProject,' in content:
    content = content.replace('import { OpenISDProject,', 'import { OpenISDProject, OpenISDDriver,')
else:
    # let's just do it directly
    content = content.replace("OpenISDProject\n} from '../domain/index.js';", "OpenISDProject, OpenISDDriver\n} from '../domain/index.js';")

with open('packages/design/app/workspace.ts', 'w') as f:
    f.write(content)

with open('packages/design/winisd/openIsdProjectToWinIsdProject.ts', 'r') as f:
    content = f.read()

# Remove 'import type' for OpenISDDriver and OpenISDProject
# Wait, maybe they are in an `import type { Box, OpenISDDriver, OpenISDProject, ... }` block?
content = content.replace("import type {\n  Box, OpenISDDriver, OpenISDProject,\n", "import type {\n  Box,\n}\nimport {\n  OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone\n")
content = content.replace("import type { Box, OpenISDDriver, OpenISDProject", "import type { Box }\nimport { OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone ")
# Actually, I'll just change `import type { Box, OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorSpec` to standard import.
content = re.sub(r'import\s+type\s+{\s*Box,\s*OpenISDDriver,\s*OpenISDProject,', 'import type { Box }\nimport { OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone,', content)

with open('packages/design/winisd/openIsdProjectToWinIsdProject.ts', 'w') as f:
    f.write(content)

