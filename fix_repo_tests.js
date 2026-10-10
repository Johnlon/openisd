import fs from 'fs';
let content = fs.readFileSync('packages/persistence/test/projectRepo.test.ts', 'utf8');
content = content.replace(/createProjectRepo\((engine, noFiles, store.tab\(\))\)/g, "createProjectRepo($1, 'http://localhost')");
// Just do a general replacement for any 3-argument call: createProjectRepo(A, B, C) -> createProjectRepo(A, B, C, 'http://localhost')
// Actually, it's safer to just run node script with a regex that handles 3 and 4 args correctly
