/**
 * `openIsdFieldKeys.ts` — the ONE vocabulary of OPENISD driver-editor field keys, with the
 * field's identity made intrinsic to it: the rendered label, and the WinISD `.wdr` key when it
 * has one.
 *
 * `OPENISD_FIELD_KEY` is the OpenISD/UI editor key vocabulary (the `data-field-key` ground
 * truth) — NOT the WDR vocabulary, NOT the WPR vocabulary. It is the layer the editor and the
 * provenance map speak, and the other formats' names attach to the same field via
 * `OPENISD_FIELDS` (the `.wdr` name when one exists).
 *
 * Every place a field key appears — the editor's `data-field-key` ground truth
 * (DriverEditorModal.vue), the provenance map (provenance.ts) — references a member of
 * `OPENISD_FIELD_KEY`, never a hand-written string. `OPENISD_FIELDS` carries the rest of the
 * field's identity keyed by the same vocabulary, and `LABEL_TO_FIELD_KEY` is DERIVED from
 * `OPENISD_FIELDS` rather than maintained as a separate map that can drift from the editor.
 *
 * Why this shape: `KLe` was once spelled `Le2`, `alfaVC` was `tc`, `Rt`/`Ct` were `Rth`/`Cth`
 * in the provenance map while the editor bound the real keys — the hand-written parallel map
 * was the bug. Now a rename is one line in `OPENISD_FIELD_KEY` and every reader follows.
 *
 * WDR identity: a `.wdr` is WinISD's INI driver file. Some fields carry a distinct WDR key
 * name (e.g. the editor key `Thick` is written to `.wdr` as `Thick`, but `Rt`'s label is
 * `R(t)`), and some fields have NO WDR key at all (`wdr` absent): the environment constants
 * `c`/`roo` are not driver fields, and `alfaVC`/`no` are derived quantities WinISD does not
 * store. Xlim is special-cased in the WDR ParState slot.
 */
export const OPENISD_FIELD_KEY = {
  // General tab — identity/attribution metadata (never a Thiele/Small quantity).
  manufacturer: 'manufacturer',
  brand: 'brand',
  model: 'model',
  providedBy: 'providedBy',
  added: 'added',
  comment: 'comment',
  // Connection wiring mode — a select, not a derivable value.
  VCCon: 'VCCon',
  // Parameters tab.
  Qes: 'Qes',
  Qms: 'Qms',
  Qts: 'Qts',
  Fs: 'Fs',
  Vas: 'Vas',
  Mms: 'Mms',
  Cms: 'Cms',
  Rms: 'Rms',
  Re: 'Re',
  BL: 'BL',
  Dd: 'Dd',
  Le: 'Le',
  Sd: 'Sd',
  fLe: 'fLe',
  KLe: 'KLe',
  Xmax: 'Xmax',
  Hc: 'Hc',
  Hg: 'Hg',
  Vd: 'Vd',
  Xlim: 'Xlim',
  Pe: 'Pe',
  no: 'no',
  Znom: 'Znom',
  USPL: 'USPL',
  SPL: 'SPL',
  numVC: 'numVC',
  // Advanced parameters tab.
  alfaVC: 'alfaVC',
  Rt: 'Rt',
  Ct: 'Ct',
  SPLmaxLF: 'SPLmaxLF',
  SPLmax: 'SPLmax',
  Rme: 'Rme',
  gamma: 'gamma',
  Mpow: 'Mpow',
  Mcost: 'Mcost',
  EBP: 'EBP',
  Gloss: 'Gloss',
  c: 'c',
  roo: 'roo',
  // Dimensions tab.
  Thick: 'Thick',
  Depth: 'Depth',
  MagDepth: 'MagDepth',
  Magnet: 'Magnet',
  Basket: 'Basket',
  Outer: 'Outer',
  Vcd: 'Vcd',
  DVol: 'DVol',
} as const;

export type OpenIsdFieldKey = keyof typeof OPENISD_FIELD_KEY;

/** The field's intrinsic identity: its rendered label, and its WinISD `.wdr` INI key when it
 *  has one. Keyed by `OpenIsdFieldKey` — a rename in `OPENISD_FIELD_KEY` fails to compile here
 *  until this table is updated, and the reverse label lookup is derived from it (never
 *  hand-maintained). */
export interface FieldDef {
  /** The `<label>` text the driver editor renders for this field. */
  label: string;
  /** The WinISD `.wdr` INI key. Absent when the field is not written to a `.wdr`: an
   *  environment constant (`c`, `roo`), or a quantity WinISD does not store (`alfaVC`, `no`). */
  wdr?: string;
}

export const OPENISD_FIELDS: Record<OpenIsdFieldKey, FieldDef> = {
  manufacturer: { label: 'Manufacturer' },
  brand: { label: 'Brand' },
  model: { label: 'Model' },
  providedBy: { label: 'Data provided by' },
  added: { label: 'Date added' },
  comment: { label: 'Comment' },
  VCCon: { label: 'Connection', wdr: 'VCCon' },
  Qes: { label: 'Qes', wdr: 'Qes' },
  Qms: { label: 'Qms', wdr: 'Qms' },
  Qts: { label: 'Qts', wdr: 'Qts' },
  Fs: { label: 'Fs', wdr: 'Fs' },
  Vas: { label: 'Vas', wdr: 'Vas' },
  Mms: { label: 'Mms', wdr: 'Mms' },
  Cms: { label: 'Cms', wdr: 'Cms' },
  Rms: { label: 'Rms', wdr: 'Rms' },
  Re: { label: 'Re', wdr: 'Re' },
  BL: { label: 'BL', wdr: 'BL' },
  Dd: { label: 'Dd', wdr: 'Dd' },
  Le: { label: 'Le', wdr: 'Le' },
  Sd: { label: 'Sd', wdr: 'Sd' },
  fLe: { label: 'fLe', wdr: 'fLe' },
  KLe: { label: 'KLe', wdr: 'KLe' },
  Xmax: { label: 'Xmax', wdr: 'Xmax' },
  Hc: { label: 'Hc', wdr: 'Hc' },
  Hg: { label: 'Hg', wdr: 'Hg' },
  Vd: { label: 'Vd', wdr: 'Vd' },
  Xlim: { label: 'Xlim', wdr: 'Xlim' },
  Pe: { label: 'Pe', wdr: 'Pe' },
  no: { label: 'no' },
  Znom: { label: 'Znom', wdr: 'Znom' },
  USPL: { label: 'USPL', wdr: 'USPL' },
  SPL: { label: 'SPL', wdr: 'SPL' },
  numVC: { label: 'Voicecoils', wdr: 'numVC' },
  alfaVC: { label: 'AlfaVC' },
  Rt: { label: 'R(t)', wdr: 'Rt' },
  Ct: { label: 'C(t)', wdr: 'Ct' },
  SPLmaxLF: { label: 'SPLmaxLF', wdr: 'SPLmaxLF' },
  SPLmax: { label: 'SPLmax', wdr: 'SPLmax' },
  Rme: { label: 'Rme', wdr: 'Rme' },
  gamma: { label: 'gamma', wdr: 'gamma' },
  Mpow: { label: 'Mpow', wdr: 'Mpow' },
  Mcost: { label: 'Mcost', wdr: 'Mcost' },
  EBP: { label: 'EBP', wdr: 'EBP' },
  Gloss: { label: 'Gloss', wdr: 'Gloss' },
  c: { label: 'c' },
  roo: { label: 'roo' },
  Thick: { label: 'Basket Plate Thickness (Thick)', wdr: 'Thick' },
  Depth: { label: 'Driver Depth (Depth)', wdr: 'Depth' },
  MagDepth: { label: 'Magnet Depth (MagDepth)', wdr: 'MagDepth' },
  Magnet: { label: 'Magnet Diameter (Magnet)', wdr: 'Magnet' },
  Basket: { label: 'Basket Diameter (Basket)', wdr: 'Basket' },
  Outer: { label: 'Outer Diameter (Outer)', wdr: 'Outer' },
  Vcd: { label: 'Voice Coil Dia (Vcd)', wdr: 'Vcd' },
  DVol: { label: 'Driver Displacement Volume (DVol)', wdr: 'DVol' },
};

/** Rendered label → field key, DERIVED from `FIELDS` so a label change is one edit in the
 *  table and the reverse lookup follows automatically — there is no second map to maintain. */
export const LABEL_TO_FIELD_KEY: Record<string, OpenIsdFieldKey> = Object.fromEntries(
  (Object.keys(OPENISD_FIELD_KEY) as OpenIsdFieldKey[]).map((k) => [OPENISD_FIELDS[k].label, k]),
) as Record<string, OpenIsdFieldKey>;