import re

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """            const isLegacy = typeof raw === 'object' && raw !== null && !('saved' in raw) && !('edited' in raw);
            const stored = isLegacy
                ? { label: (raw as { meta?: { name?: string } }).meta?.name ?? '', saved: raw, edited: null }
                : raw;""",
    """            const isLegacy = typeof raw === 'object' && raw !== null && !('saved' in raw) && !('edited' in raw);
            const meta = isLegacy && 'meta' in raw && typeof raw.meta === 'object' && raw.meta !== null ? raw.meta : null;
            const name = meta && 'name' in meta && typeof meta.name === 'string' ? meta.name : '';
            const stored = isLegacy
                ? { label: name, saved: raw, edited: null }
                : raw;"""
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)
