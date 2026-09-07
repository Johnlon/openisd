import re

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

# Update imports
content = content.replace(
    "import { type OpenISDProjectJson, openISDProjectJsonSchema } from './openisdSchema.js';",
    "import { type OpenISDProjectSessionJson, openISDProjectSessionJsonSchema } from './openisdSchema.js';"
)

# Update projectRepo
repoCode = """export function projectRepo(make: RecordStoreFactory, engine: Engine): ProjectRepo {
    const store = make<OpenISDProjectSessionJson>('saved.meta.name');
    return {
        save(project: OpenISDProject): void {
            const session = project.cloneSession();
            store.put(project.uuid(), session);
        },

        load(id: string): OpenISDProject | string[] {
            const stored = store.get(id);
            if (!stored) return [`no stored project with id ${id}`];
            const result = openISDProjectSessionJsonSchema.safeParse(stored);
            if (!result.success) {
                return result.error.issues.map(issue => issue.path.length === 0
                    ? issue.message
                    : `'${issue.path.join('.')}': ${issue.message}`);
            }
            return OpenISDProject.wrapSession(result.data, id, engine);
        },"""

content = re.sub(
    r'export function projectRepo\(make: RecordStoreFactory, engine: Engine\): ProjectRepo \{.*?return OpenISDProject\.wrapWithIdentity\(result\.data, id, engine\);\n        \},',
    repoCode,
    content,
    flags=re.DOTALL
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)
