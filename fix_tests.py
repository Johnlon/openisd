import re

# Fix openisdSchema.ts global mutable state
with open('packages/design/domain/openisdSchema.ts', 'r') as f:
    schema = f.read()
schema = schema.replace('export const OpenISDDeviceJson = {', 'export const OpenISDDeviceJson = Object.freeze({')
schema = schema.replace('    }\n};\n', '    }\n});\n')
with open('packages/design/domain/openisdSchema.ts', 'w') as f:
    f.write(schema)

# Fix persistence.test.ts corrupt payload
with open('packages/design/test/persistence.test.ts', 'r') as f:
    persistence = f.read()
persistence = persistence.replace("corruptRepo.raw.set('corrupt-id', { meta: {} });", "corruptRepo.raw.set('corrupt-id', { label: 'corrupt', saved: { meta: {} }, edited: null });")
with open('packages/design/test/persistence.test.ts', 'w') as f:
    f.write(persistence)
