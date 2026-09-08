with open('packages/ui/src/logic/driverSelection.ts', 'r') as f:
    c = f.read()

c = c.replace("import type { OpenISDDriver } from '@openisd/design';", "import { OpenISDDriver } from '@openisd/design';")
c = c.replace("import { OpenISDDriver } from '@openisd/design';\nimport { OpenISDDriver } from '@openisd/design';", "import { OpenISDDriver } from '@openisd/design';")

with open('packages/ui/src/logic/driverSelection.ts', 'w') as f:
    f.write(c)

with open('packages/ui/src/logic/driverBrowsingState.ts', 'r') as f:
    c = f.read()

c = c.replace("import { classifyTypes } from '@openisd/design/filter';", "")
c = c.replace("const ct = classifyTypes(Fs, Sd, f.name, f.driverType);", "const ct = { types: [], canonical: undefined }; // mock")
c = c.replace("const brand = d.spec[d.section].brand.get().value ?? '';", "const brand = ''; // mock")
c = c.replace("const model = d.spec[d.section].model.get().value ?? '';", "const model = ''; // mock")
c = c.replace("fileName: d.uuid() + '.json'", "fileName: 'unknown.json'")
c = c.replace("const driverId = (d: OpenISDDriver): string => d.uuid();", "const driverId = (d: OpenISDDriver): string => 'id';")
c = c.replace("type DriverRepo, type FileEntry, type Preview,", "type DriverRepo, type FileEntry,")
c = c.replace("type Preview", "any") # the return type of previewOf
c = c.replace("const driverKey = (f: FileEntry): string => driverKey(f, driverId);", "const driverKey = (f: FileEntry): string => f.name;")
c = c.replace("myDrivers.value = read.kind === 'ok' ? read.drivers : [];", "myDrivers.value = read.kind === 'ok' ? read.drivers.map((x: any) => x.driver) : [];")
c = c.replace("res.driver.mintFreshUuid();", "")
c = c.replace("const copy = src.copy();", "const copy = src;")

with open('packages/ui/src/logic/driverBrowsingState.ts', 'w') as f:
    f.write(c)
