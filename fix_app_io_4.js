import fs from 'fs';
let content = fs.readFileSync('packages/ui/src/logic/applicationIO.ts', 'utf8');

// I will just put the isRecord function outside of the file parsing logic or just top-level
const guard = `function isRec(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }\n`;

content = content.replace(/let isArchive = false;[\s\S]*?\} catch \{ \/\* not json \*\/ \}/, `let isArchive = false;
          try {
            const parsed: unknown = JSON.parse(text);
            isArchive = isRec(parsed) && 'projects' in parsed && Array.isArray(parsed.projects);
          } catch { /* not json */ }`);

if (!content.includes('function isRec')) {
  content = content.replace(/export function createApplicationIO/, guard + 'export function createApplicationIO');
}

fs.writeFileSync('packages/ui/src/logic/applicationIO.ts', content);
