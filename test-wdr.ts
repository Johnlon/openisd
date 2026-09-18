import { winIsdDriverTextToOpenIsdDriver } from './packages/design/domain/driverYmlToOpenisdAndWdr.ts';
import { OpenISDDriver } from './packages/design/domain/openisdDomain.ts';
import { Engine } from './packages/design/engine/index.ts';

const wdr = [
  '[Driver]', 'Brand=Twice', 'Model=Imported', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
  'DateAdded=', 'DateModified=', 'Qts=0.4', 'Fs=40', 'Re=6', 'ParState=' + 'N'.repeat(49), '',
].join('\r\n');

const engine = new Engine();
const res = winIsdDriverTextToOpenIsdDriver(wdr, engine);
if (!res.value) {
  console.log("ERRORS:", res.errors);
} else {
  const cloned = res.value.cloneDriver();
  console.log("JSON:", JSON.stringify(cloned, null, 2));
  const readBack = OpenISDDriver.fromConformingRecord(cloned, engine);
  if (Array.isArray(readBack)) {
    console.log("READ BACK FAILED:", readBack);
  } else {
    console.log("READ BACK SUCCESS");
  }
}
