import fs from 'fs';
let content = fs.readFileSync('packages/ui/src/logic/applicationIO.ts', 'utf8');

// Insert new imports after the first import block
const imports = `
import { Engine } from '@openisd/design/engine';
import { OpenISDProject } from '@openisd/design';
`;
content = content.replace(/import \{/, imports + 'import {');
content = content.replace(/type ProjectRepo,/, 'type ProjectRepo, buildProjectsArchive, parseProjectsArchive,');

fs.writeFileSync('packages/ui/src/logic/applicationIO.ts', content);
