import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/createMemoryStorage\(,\s*'http:\/\/localhost'\)/g, "createMemoryStorage(), 'http://localhost'");
  fs.writeFileSync(filePath, content);
}

fixFile('packages/ui/test/logic/applicationIO.test.ts');
fixFile('packages/ui/test/logic/fileImportExport.test.ts');
fixFile('packages/ui/test/logic/sessionSync.test.ts');
fixFile('packages/ui/test/logic/urlAppState.test.ts');
