import fs from 'fs';
let content = fs.readFileSync('packages/persistence/test/projectRepo.test.ts', 'utf8');

// Fix 3-argument calls
content = content.replace(/createProjectRepo\(engine, noFiles, store\.tab\(\)\)/g, "createProjectRepo(engine, noFiles, store.tab(), 'http://localhost')");

// Fix TS2673: Constructor of class 'OpenISDProject' is private
content = content.replace(/new OpenISDProject\(engine\)/g, "OpenISDProject.empty(engine)");

fs.writeFileSync('packages/persistence/test/projectRepo.test.ts', content);
