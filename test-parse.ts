import { driverFromFileText } from './packages/ui/src/logic/driverSelection.js';
const wdr = [
  '[Driver]', 'Brand=Twice', 'Model=Imported', 'Manufacturer=', 'ProvidedBy=', 'Comment=',
  'DateAdded=', 'DateModified=', 'Qts=0.4', 'Fs=40', 'Re=6', 'ParState=' + 'N'.repeat(49), '',
].join('\r\n');
const res = driverFromFileText(wdr, 'wdr', 'twice.wdr');
console.log(res);
