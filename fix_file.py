import re
with open('packages/design/winisd/openIsdProjectToWinIsdProject.ts', 'r') as f:
    content = f.read()

content = content.replace("import type {\n  Box,\n}\nimport {\n  OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone\n} from '../domain/index.js';", "import type { Box } from '../domain/index.js';\nimport { OpenISDDriver, OpenISDProject, OpenISDPassiveRadiatorStandalone } from '../domain/index.js';")

with open('packages/design/winisd/openIsdProjectToWinIsdProject.ts', 'w') as f:
    f.write(content)
