import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# 1. Imports
code = re.sub(r"import \{ OpenISDDriver, OpenISDProject, Provenance \} from '@openisd/design';", 
  "import { OpenISDDriver, OpenISDProject, type CellState } from '@openisd/design';", code)
code = re.sub(r"import \{ WinISDDriver \} from '@openisd/winisd';", 
  "import { WinISDDriver } from '@openisd/design/winisd';\nimport { Engine } from '@openisd/design/engine';\nimport { winISDDriverToOpenISDDeviceJson } from '@openisd/design/domain/openisdSchema';", code)

# 2. sampleDriverText
old_sample = """function sampleDriverText(): string {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdrText)).toOwdrJson();
}"""
new_sample = """function sampleDriverText(): any {
  const wdr = WinISDDriver.fromWdrIni(wdrText);
  const {record} = winISDDriverToOpenISDDeviceJson(wdr);
  return record;
}"""
code = code.replace(old_sample, new_sample)

# 3. projectOf
old_projectOf = """function projectOf(box: BoxType, meta: OpenISDProjectMeta,
  driverText: string, params: Partial<UiParams>): OpenISDProject {
  const project = OpenISDProject.empty(OpenISDDriver.fromOwdrJson(driverText));
  project.loadUiParams(params, box);
  project.setProjectMeta(meta);
  return project;
}"""
new_projectOf = """function projectOf(box: BoxType, meta: OpenISDProjectMeta,
  driverRecord: any, params: Partial<UiParams>): OpenISDProject {
  const driver = OpenISDDriver.fromConformingRecord(driverRecord, new Engine());
  if (Array.isArray(driver)) throw new Error('Bad driver');
  
  const builder = OpenISDProject.builder(driver, new Engine());
  let project: OpenISDProject;
  if (box === 'sealed') project = builder.sealed().build();
  else if (box === 'vented') project = builder.vented().build();
  else if (box === 'bandpass4') project = builder.bandpass4().build();
  else project = builder.sealed().build(); // fallback
  
  project.name.set(meta.name);
  project.creator.set(meta.creator);
  return project;
}"""
code = code.replace(old_projectOf, new_projectOf)

# 4. Provenance usages
code = code.replace("Provenance.Entered", "'entered'")
code = code.replace("Provenance.Calculated", "'calculated'")
code = code.replace("Provenance.NotAvailable", "'not-available'")

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)
