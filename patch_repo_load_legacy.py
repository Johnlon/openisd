import re

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """        load(id: string): OpenISDProject | string[] {
            const raw = store.get(id);
            if (!raw) return [`no stored project with id ${id}`];
            
            // Handle legacy projects that were saved directly as OpenISDProjectJson
            const isLegacy = typeof raw === 'object' && raw !== null && !('saved' in raw) && !('edited' in raw);
            const meta = isLegacy && 'meta' in raw && typeof raw.meta === 'object' && raw.meta !== null ? raw.meta : null;
            const name = meta && 'name' in meta && typeof meta.name === 'string' ? meta.name : '';
            const stored = isLegacy
                ? { label: name, saved: raw, edited: null }
                : raw;
            // THE LOAD BOUNDARY (QO116): `stored` is `R` only by the store's own type parameter, a
            // compile-time promise nothing at runtime enforced on whatever is actually behind it.
            // One `.safeParse()` here validates the WHOLE project record before anything downstream
            // ever sees it — never a per-section check, per QO116 ("validate the whole project in
            // a single .parse() at the load boundary. Not three standalone schemas").
            const result = openISDProjectSessionJsonSchema.safeParse(stored);""",
    """        load(id: string): OpenISDProject | string[] {
            const stored = store.get(id);
            if (!stored) return [`no stored project with id ${id}`];
            // THE LOAD BOUNDARY (QO116): `stored` is `R` only by the store's own type parameter, a
            // compile-time promise nothing at runtime enforced on whatever is actually behind it.
            // One `.safeParse()` here validates the WHOLE project record before anything downstream
            // ever sees it — never a per-section check, per QO116 ("validate the whole project in
            // a single .parse() at the load boundary. Not three standalone schemas").
            const result = openISDProjectSessionJsonSchema.safeParse(stored);"""
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)
