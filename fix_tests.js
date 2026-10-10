import fs from 'fs';

const path = 'packages/persistence/test/projectRepo.test.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix the corrupted lines
content = content.replace(/createMemoryStorage\(\), 'http:\/\/localhost';/g, 'createMemoryStorage();');

// Fix createProjectRepo calls
content = content.replace(/createProjectRepo\(([^,]+),\s*([^,]+),\s*([^,]+),\s*onRepaired\)/g, "createProjectRepo($1, $2, $3, 'http://localhost', onRepaired)");

fs.writeFileSync(path, content);
