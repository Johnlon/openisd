import fs from 'fs';
let content = fs.readFileSync('packages/ui/src/logic/applicationIO.ts', 'utf8');

const importsToAdd = `
import { Engine } from '@openisd/design/engine';
import { OpenISDProject } from '@openisd/design';
import { buildProjectsArchive, parseProjectsArchive } from '@openisd/persistence/repos/projectsArchive';
`;
// Wait, projectsArchive is in packages/persistence/src/repos/projectsArchive.ts
// I should use the correct import path!
