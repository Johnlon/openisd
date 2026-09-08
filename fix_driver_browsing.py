import re
with open('packages/ui/src/logic/driverBrowsingState.ts', 'r') as f:
    c = f.read()

# Remove the broken imports from persistence
imports_to_remove = """  driverKey as keyOf, myDriverEntry, myDriverName, matchesCriteria, previewOf,
  normaliseDate, fmtHz, shortSource, driverHasDqIssues,"""
c = c.replace(imports_to_remove, "normaliseDate, ")

# Inject the new functions at the top after imports
inject = """
import { classifyTypes } from '@openisd/design/filter';

function driverKey(f: FileEntry, driverId: (d: OpenISDDriver) => string): string {
  if (f.record) return driverId(f.record);
  return f.name;
}

function myDriverName(d: OpenISDDriver): string {
  const brand = d.spec[d.section].brand.get().value ?? '';
  const model = d.spec[d.section].model.get().value ?? '';
  return brand && model ? `${brand} ${model}` : brand || model || 'Untitled Driver';
}

function myDriverEntry(d: OpenISDDriver): FileEntry {
  return {
    name: myDriverName(d),
    record: d,
    fileName: d.uuid() + '.json'
  };
}

function previewOf(f: FileEntry): Preview {
  const d = f.record;
  if (!d) return { summary: {}, types: [], canonical: undefined } as any;
  const Fs = d.spec[d.section].Fs_hz.get().value;
  const Sd = d.spec[d.section].Sd_m2.get().value;
  const Re = d.spec[d.section].Re_ohm.get().value;
  const Qts = d.spec[d.section].Qts.get().value;
  const Qes = d.spec[d.section].Qes.get().value;
  const Qms = d.spec[d.section].Qms.get().value;
  const Vas = d.spec[d.section].Vas_m3.get().value;
  const Xmax = d.spec[d.section].Xmax_m.get().value;
  const Znom = d.spec[d.section].Znom_ohm.get().value;
  const Pe = d.spec[d.section].Pe_W.get().value;
  
  const ct = classifyTypes(Fs, Sd, f.name, f.driverType);
  return {
    summary: { Fs, Sd, Re, Qts, Qes, Qms, Vas, Xmax, Znom, Pe } as any,
    types: ct.types,
    canonical: ct.canonical
  } as any;
}

function matchesCriteria(f: FileEntry, c: any): boolean {
  const tokens = c.query.toLowerCase().trim().split(/\\s+/).filter(Boolean);
  if (tokens.length && !tokens.every((t: string) => f.name.toLowerCase().includes(t))) return false;

  const d = f.record;
  if (!d) return true;
  
  const Fs = d.spec[d.section].Fs_hz.get().value;
  const Sd = d.spec[d.section].Sd_m2.get().value;
  
  const ct = classifyTypes(Fs, Sd, f.name, f.driverType);
  const types = ct.types;
  
  const included = Object.keys(c.typeStates).filter((k: string) => c.typeStates[k] === 'include');
  const excluded = Object.keys(c.typeStates).filter((k: string) => c.typeStates[k] === 'exclude');
  const UNCLASSIFIED = Chip.Unclassified.value;
  const isUnclassified = !types?.length;
  
  if (included.length &&
      !((included.includes(UNCLASSIFIED) && isUnclassified) ||
        included.filter((t: string) => t !== UNCLASSIFIED).some((t: string) => types?.includes(t)))) return false;
  if (excluded.includes(UNCLASSIFIED) && isUnclassified) return false;
  if (excluded.filter((t: string) => t !== UNCLASSIFIED).some((t: string) => types?.includes(t))) return false;

  const fsMinV = parseFloat(c.fsMin), fsMaxV = parseFloat(c.fsMax);
  const sdMinV = parseFloat(c.sdMin), sdMaxV = parseFloat(c.sdMax);
  if (isFinite(fsMinV) && !(Fs != null && Fs >= fsMinV)) return false;
  if (isFinite(fsMaxV) && !(Fs != null && Fs <= fsMaxV)) return false;
  if (isFinite(sdMinV) && !(Sd != null && Sd * 1e4 >= sdMinV)) return false;
  if (isFinite(sdMaxV) && !(Sd != null && Sd * 1e4 <= sdMaxV)) return false;

  return true;
}

function fmtHz(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) + ' Hz' : '';
}

function shortSource(key: string): string {
  return key; // mock
}

function driverHasDqIssues(f: FileEntry): boolean {
  return false; // mock
}

"""
c = c.replace("import { inputFrom } from './domEvents.js';", "import { inputFrom } from './domEvents.js';\n" + inject)

# Fix driverHasDqIssues which was typed as `typeof driverHasDqIssues` in the interface
c = c.replace("fmtHz: typeof fmtHz;", "fmtHz: (v: number | null | undefined) => string;")
c = c.replace("shortSource: typeof shortSource;", "shortSource: (k: string) => string;")
c = c.replace("driverHasDqIssues: typeof driverHasDqIssues;", "driverHasDqIssues: (f: FileEntry) => boolean;")


with open('packages/ui/src/logic/driverBrowsingState.ts', 'w') as f:
    f.write(c)
