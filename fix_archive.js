import fs from 'fs';
let content = fs.readFileSync('packages/persistence/src/repos/projectsArchive.ts', 'utf8');

// Replace isProjectArchive
content = content.replace(/function isProjectArchive[\s\S]*?return true;\n\}/, `function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isProjectArchive(obj: unknown): obj is ProjectArchive {
  if (!isRecord(obj)) return false;
  if (obj.version !== 1) return false;
  if (!Array.isArray(obj.projects)) return false;
  for (const p of obj.projects) {
    if (!isRecord(p) || typeof p.text !== 'string') return false;
  }
  return true;
}`);

// Replace the fallback version check
content = content.replace(/if \(\(parsed as Record<string, unknown>\)\.version !== 1\) \{/g, `if (isRecord(parsed) && parsed.version !== 1) {`);
content = content.replace(/\(parsed as Record<string, unknown>\)\.version/g, `String(isRecord(parsed) ? parsed.version : '')`);

fs.writeFileSync('packages/persistence/src/repos/projectsArchive.ts', content);
