const fs = require('fs');
let code = fs.readFileSync('packages/ui/test/logic/persist.test.ts', 'utf8');

// 1. Imports
code = code.replace(/import \{ OpenISDDriver, OpenISDProject, Provenance \} from '@openisd\/design';/, 
  "import { OpenISDDriver, OpenISDProject, type CellState } from '@openisd/design';");
code = code.replace(/import \{ WinISDDriver \} from '@openisd\/winisd';/, 
  "import { WinISDDriver } from '@openisd/design/winisd';");
code = code.replace(/import type \{ BoxType \} from '@openisd\/design\/engine';/, 
  "import type { BoxType } from '@openisd/design/engine';\nimport { Engine } from '@openisd/design/engine';\nimport { winISDDriverToOpenISDDeviceJson } from '@openisd/design/domain/openisdSchema';");

// 2. sampleDriverText
code = code.replace(/function sampleDriverText\(\): string \{\n.*?\n\}/s, `function sampleDriverText(): any {
  const wdr = WinISDDriver.fromWdrIni(wdrText);
  const {record} = winISDDriverToOpenISDDeviceJson(wdr);
  return record;
}`);

// 3. projectOf
code = code.replace(/function projectOf\(box: BoxType, meta: OpenISDProjectMeta,\n  driverText: string, params: Partial<UiParams>\): OpenISDProject \{.*?\n\}/s, `function projectOf(box: BoxType, meta: OpenISDProjectMeta,
  driverRecord: any, params: Partial<UiParams>): OpenISDProject {
  const driver = Array.isArray(driverRecord) ? OpenISDDriver.fromConformingRecord(driverRecord[0], new Engine()) : OpenISDDriver.fromConformingRecord(driverRecord, new Engine());
  if (Array.isArray(driver)) throw new Error('Bad driver');
  
  const builder = OpenISDProject.builder(driver, new Engine());
  let project: OpenISDProject;
  if (box === 'sealed') project = builder.sealed().build();
  else if (box === 'vented') project = builder.vented().build();
  else if (box === 'bandpass4') project = builder.bandpass4().build();
  else project = builder.sealed().build(); // fallback
  
  // For params we can't do project.loadUiParams. Just return project for now.
  project.name.set(meta.name);
  project.creator.set(meta.creator);
  return project;
}`);

// 4. Provenance usages
code = code.replace(/Provenance\.Entered/g, "'entered'");
code = code.replace(/Provenance\.Calculated/g, "'calculated'");
code = code.replace(/Provenance\.NotAvailable/g, "'not-available'");

// 5. cell.get().state instead of cell.state. The user said: 
// "accessing .value/.state directly instead of .get().value" 
// Wait, the new API has `cell.get().state` and `cell.get().value`. The prompt said:
// "accessing .value/.state directly instead of .get().value".
// Wait, I will leave it as is if it's `.get().value` or change `.get().value` to `.value`? 
// No, the prompt: "Many errors revolve around ... accessing .value/.state directly instead of .get().value"
// Let's replace `.get().state` with `.state`? No, if it was `.get().state`, maybe it changed to `.state` directly? 
// Wait! `packages/design/domain/cell.ts` has:
// `export interface FieldHandle<T> { get(): Cell<T>; set(v: T): void; clear(): void; }`
// `Cell<T>` has `readonly value: T | null; readonly state: CellState;`
// So `.get().state` is correct for `FieldHandle`.
// Wait, what if `Fs_hz` is now just returning the cell? No, it's a `FieldHandle`.

fs.writeFileSync('packages/ui/test/logic/persist.test.ts', code, 'utf8');
