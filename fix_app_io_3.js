import fs from 'fs';
let content = fs.readFileSync('packages/ui/src/logic/applicationIO.ts', 'utf8');

content = content.replace(/let function isRec[\s\S]*?\} catch \{ \/\* not json \*\/ \}/, `
          let isArchive = false;
          try {
            const parsed: unknown = JSON.parse(text);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && 'projects' in parsed) {
              const asRec = parsed as Record<string, unknown>;
              isArchive = Array.isArray(asRec.projects);
            }
          } catch { /* not json */ }`);
          
fs.writeFileSync('packages/ui/src/logic/applicationIO.ts', content);
