with open('packages/ui/test/persistence/round-trip-gate.test.ts', 'r') as f:
    c = f.read()

# Add imports
c = c.replace(
    "import { OpenISDDriver } from '@openisd/design';",
    "import { OpenISDDriver } from '@openisd/design';\nimport { Engine } from '@openisd/design/engine';\nimport { openIsdDriverToWinIsdDriver } from '@openisd/design/winisd';\nimport { stringify as yamlStringify } from 'yaml';\n\nconst _engine = new Engine();\nfunction fromJsonRecord(record: unknown) {\n  const yml = yamlStringify(record);\n  const driver = OpenISDDriver.fromYml(yml, _engine);\n  if (Array.isArray(driver)) throw new Error('fromYml failed: ' + driver.join(', '));\n  return {\n    toWdrText(): { value: string | null; errors: Array<{level: string; message: string}> } {\n      const result = openIsdDriverToWinIsdDriver(driver, undefined, undefined, _engine);\n      if (Array.isArray(result) || !result) return { value: null, errors: [{ level: 'error', message: 'conversion failed' }] };\n      const wd = (result as any).value ?? result;\n      if (!wd) return { value: null, errors: (result as any).errors ?? [] };\n      return { value: wd.toWdrIni(), errors: (result as any).errors ?? [] };\n    }\n  };\n}"
)

# Fix call sites
c = c.replace(
    "const { value: wdrText, errors } = OpenISDDriver.fromJsonRecord(record).toWdrText();",
    "const { value: wdrText, errors } = fromJsonRecord(record).toWdrText();"
)
c = c.replace(
    "const { value: wdrText } = OpenISDDriver.fromJsonRecord(record).toWdrText();",
    "const { value: wdrText } = fromJsonRecord(record).toWdrText();"
)

# Fix implicit any parameters
c = c.replace(".some(e => e.level === 'error')", ".some((e: any) => e.level === 'error')")

with open('packages/ui/test/persistence/round-trip-gate.test.ts', 'w') as f:
    f.write(c)
