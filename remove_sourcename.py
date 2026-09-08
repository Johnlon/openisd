import re

# 1. Strip fields from FileEntry in driverRepo.ts
with open('packages/persistence/src/repos/driverRepo.ts', 'r') as f:
    c = f.read()

c = c.replace("  sourceKey?: string; sourceName?: string; sourceUrl?: string; sourceDesc?: string;\n", "")
c = c.replace("      sourceKey: src.key,\n      sourceName: src.name,\n      sourceUrl: src.url || '',\n      sourceDesc: src.description || '',\n", "")

with open('packages/persistence/src/repos/driverRepo.ts', 'w') as f:
    f.write(c)

# 2. Strip from driverBrowsingState.ts — remove shortSource stub and references
with open('packages/ui/src/logic/driverBrowsingState.ts', 'r') as f:
    c = f.read()

# Remove shortSource function and its interface entry and export
c = c.replace("function shortSource(key: string): string {\n  return key; // mock\n}\n", "")
c = c.replace("  shortSource: (k: string) => string;\n", "")
c = c.replace("\n  shortSource,", "")

with open('packages/ui/src/logic/driverBrowsingState.ts', 'w') as f:
    f.write(c)

print("Done")
