import re

with open('packages/design/domain/openisdRepo.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "const store = make<OpenISDProjectSessionJson>('saved.meta.name');",
    "const store = make<OpenISDProjectSessionJson>('label');"
)

content = content.replace(
    """            // Handle legacy projects that were saved directly as OpenISDProjectJson
            if (stored && typeof stored === 'object' && !('saved' in stored) && !('edited' in stored)) {
                stored = { saved: stored, edited: null } as any;
            }""",
    """            // Handle legacy projects that were saved directly as OpenISDProjectJson
            if (stored && typeof stored === 'object' && !('saved' in stored) && !('edited' in stored)) {
                const legacy = stored as any;
                stored = { label: legacy.meta?.name ?? '', saved: legacy, edited: null } as any;
            }"""
)

with open('packages/design/domain/openisdRepo.ts', 'w') as f:
    f.write(content)
