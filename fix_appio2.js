import fs from 'fs';
let content = fs.readFileSync('packages/ui/src/logic/applicationIO.ts', 'utf8');

// We have:
// isArchive = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && 'projects' in parsed && Array.isArray((parsed as Record<string, unknown>).projects);

content = content.replace(/isArchive = [^;]+;/, `function isRec(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
            isArchive = isRec(parsed) && Array.isArray(parsed.projects);`);

fs.writeFileSync('packages/ui/src/logic/applicationIO.ts', content);
