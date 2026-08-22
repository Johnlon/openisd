/**
 * `driver.yml` text -> `openisd.yml` text, direct — the seam `winisd_tools` calls in-process
 * (embedded V8) once it has emitted a record, replacing the Python projection that used to
 * run this step (`winisd_tools/scrapers/scrapers/lib/model_openisd.py::OpenIsdYmlFile.from_metadata`
 * + `.to_yaml()`, and the shared canonical-order serialiser
 * `winisd_tools/scrapers/scrapers/lib/model_driver.py::canonical_yaml`/`_canonicalise`).
 *
 * SCOPE: this projects an ALREADY-VALID `driver.yml` — one that passed
 * `DriverFile._record_constraints` on the Python side before being written. `from_metadata`
 * itself does no re-derivation (it reads fields straight off a validated `DriverFile`;
 * `QualityBlock.disposition`/`confirmed_fields`/`fields_with_issues`/`SpecEntry.corroboration`
 * were all derived at THAT validation, not at projection time), so this port does none either:
 * it selects fields, conforms `model`, and re-serialises in canonical order. It does not
 * re-validate record-level constraints, re-derive DQ verdicts, or re-run the compound-coil/
 * flange-orientation validators `SpecSection` runs on load — a `driver.yml` that needs any of
 * that has not been emitted correctly, and this function is not the place that would catch it.
 *
 * Field types are declared fresh here rather than reusing `_OpenISDDriverJson`
 * (`openisdDriver.ts`) — checked against the current Python model (`model_driver.py`,
 * `model_openisd.py` @ winisd_tools 16492ffc) `_OpenISDDriverJson` diverges from it: `quality`
 * there carries no `disposition`/`no_ts_published` (this projection nests both inside
 * `quality`, matching `QualityBlock`) and it carries a `name` field the Python record does not
 * have. `_OpenISDDriverJson` is `OpenISDDriver`'s own in-app state shape, not a literal
 * `openisd.yml` schema mirror; this module targets the actual file format instead of that type.
 *
 * Returns a STRING, matching `openisdYamlToWdr`'s convention: `errors` names what is wrong
 * when the projection cannot complete; `value` is null then, never a thrown exception.
 */
import { parse, Document, visit, YAMLMap, YAMLSeq, Pair, isScalar } from 'yaml';
import type { DriverError, Result } from '@openisd/engine';

// ── The envelope kinds a driver.yml / openisd.yml field is built from ──────────────────────
// model_driver.py:181-232 (ScrapedField / DerivedField / BookkeepingField), 439-538 (SpecEntry).

type SourceRole =
  | 'manufacturer_datasheet'
  | 'manufacturer_product_page'
  | 'manufacturer_listing_page'
  | 'distributor_datasheet'
  | 'distributor_product_page'
  | 'distributor_listing_page'
  | 'manual';

interface DrReading {
  actual_reading: string;
  read_value?: number;
  read_precision?: number;
  conformed_reading?: string;
  conformed_by?: string;
  rejected?: string;
  note?: string;
}

interface DrGround {
  origin: SourceRole;
  reading: string;
  definition: string;
}

interface DrDqMark {
  kind: string;
  severity: string;
  rule: string;
  params: Record<string, unknown>;
  detail: string;
}

interface DrScrapedField<T> {
  value: T;
  origin: SourceRole;
  readings?: Partial<Record<SourceRole, T>>;
  definition: string;
  dq_marks?: DrDqMark[];
  note?: string;
}

interface DrDerivedField<T> {
  value: T;
  definition: string;
  grounds: DrGround[];
}

interface DrBookkeepingField<T> {
  value: T;
  definition: string;
}

interface DrDispositionField {
  value: string;
  definition: string;
  detail: string;
}

interface DrSpecEntry {
  origin: SourceRole;
  readings: Partial<Record<SourceRole, DrReading>>;
  definition?: string;
  dq_marks?: DrDqMark[];
  corroboration?: string;
}

interface DrCrossSourceReading {
  field: string;
  origin: SourceRole;
  reading: DrReading;
}

interface DrQualityBlock {
  disposition: DrDispositionField;
  no_ts_published: DrBookkeepingField<boolean>;
  rating: string;
  issue?: string;
  confirmed_fields: string[];
  fields_with_issues: string[];
  missing: string[];
  invalid: string[];
  parse_errors: string[];
  cross_source_only: DrCrossSourceReading[];
}

interface DrSpecSection {
  [field: string]: DrSpecEntry | undefined;
}

interface DrSpecs {
  woofer?: DrSpecSection;
  tweeter?: DrSpecSection;
  passive_radiator?: DrSpecSection;
}

interface DrCurvesBlock {
  frequency_response?: unknown;
  impedance?: unknown;
}

/** `DriverFile`'s field set (model_driver.py:1243-1262), minus `scraper_meta` — the exact
 *  set `OpenIsdYmlFile.from_metadata` copies (`model_openisd.py:47`: "every field except
 *  scraper_meta"). `model` is handled separately (conformed from `series` + `model`). */
interface DriverYml {
  uuid: DrBookkeepingField<string>;
  quality: DrQualityBlock;
  manufacturer: DrScrapedField<string>;
  brand: DrScrapedField<string>;
  model: DrScrapedField<string>;
  sku: DrDerivedField<string>;
  driver_type: DrScrapedField<string>;
  series?: DrScrapedField<string>;
  nominal_size_cm?: DrScrapedField<number>;
  data_sources: DrBookkeepingField<Partial<Record<SourceRole, string>>>;
  authoritative: DrBookkeepingField<SourceRole>;
  product_image?: DrScrapedField<string>;
  description?: DrScrapedField<string>;
  surround_material?: DrScrapedField<string>;
  provided_by?: DrScrapedField<string>;
  comment?: DrScrapedField<string>;
  added?: DrScrapedField<string>;
  specs: DrSpecs;
  curves?: DrCurvesBlock;
  scraper_meta?: unknown;
}

/** The fields `OpenIsdYmlFile` copies through UNCHANGED — `DriverYml`'s own field set minus
 *  `model` (conformed separately, below) and `scraper_meta` (dropped — model_openisd.py:17-21,
 *  "the method bag is pipeline telemetry, not UI data"). Declared once so the copy loop and
 *  the "what did this drop" reasoning live in the same place. */
const PASSTHROUGH_FIELDS = [
  'uuid', 'quality', 'manufacturer', 'brand', 'sku', 'driver_type', 'series',
  'nominal_size_cm', 'data_sources', 'authoritative', 'product_image', 'description',
  'surround_material', 'provided_by', 'comment', 'added', 'specs', 'curves',
] as const satisfies readonly (keyof DriverYml)[];

// ── Canonical key order — ported verbatim from model_driver.py:1584-1628 (_KEY_PRIORITY_LIST)
// so every mapping this projection can produce sorts identically to the Python serialiser.
// `scraper_meta`/its own keys are kept in the list (they never appear in openisd.yml output,
// since PASSTHROUGH_FIELDS never carries that key) purely so this stays a faithful copy of the
// shared list rather than a silently-diverged subset. ────────────────────────────────────────
const KEY_PRIORITY_LIST: readonly string[] = [
  // record top level
  'uuid', 'quality',
  // quality block — disposition leads it
  'disposition', 'no_ts_published', 'rating', 'issue', 'confirmed_fields',
  'fields_with_issues', 'missing', 'invalid', 'parse_errors', 'cross_source_only',
  // identity
  'manufacturer', 'brand', 'model', 'sku', 'driver_type', 'series',
  'nominal_size_cm',
  'data_sources', 'authoritative', 'product_image',
  'description', 'surround_material', 'provided_by', 'comment', 'added',
  // data blocks
  'specs', 'woofer', 'tweeter', 'passive_radiator',
  // CANONICAL_SPEC_FIELDS (record_registries.py:300-311) — _SPEC_TS_FIELDS then
  // _SPEC_DESCRIPTIVE_FIELDS, verbatim order.
  'Fs', 'Re', 'Le', 'fLe', 'KLe', 'Znom', 'Qts', 'Qes', 'Qms',
  'Vas', 'Sd', 'BL', 'Mms', 'Cms', 'Rms', 'Xmax', 'Xlim',
  'SPL', 'Pe', 'Dd', 'EBP', 'numVC', 'VCCon',
  'voice_coil_dia_mm', 'Hg_mm', 'Hc_mm', 'freq_low_hz', 'freq_high_hz',
  'power_peak_W', 'weight_kg',
  'thick_mm', 'depth_mm', 'magnet_depth_mm', 'magnet_dia_mm',
  'basket_dia_mm', 'outer_dia_mm', 'outer_x_mm', 'outer_y_mm', 'driver_volume_l',
  'curves', 'frequency_response', 'impedance',
  // `scraper_meta`'s OWN key set (record_registries.py:469-495, `SCRAPER_META_KEYS`), spliced
  // in verbatim (`*SCRAPER_META_KEYS`, model_driver.py:1601) — never used to order a
  // `scraper_meta` block itself (openisd.yml never carries one; `_SCRAPER_META_PRIORITY` owns
  // that when it does, on the driver.yml side), but its FIRST-OCCURRENCE priority still claims
  // any name it shares with a real openisd.yml key that has not already appeared above. `note`
  // is exactly that collision: it is a scraper_meta key ("generic scraper provenance or
  // execution note") that also happens to be `Reading.note`'s field name, and because this
  // splice runs before the "envelope keys" block below states `note` explicitly, THIS
  // occurrence wins — a `Reading.note` therefore sorts ahead of `actual_reading`, not after,
  // reproducing the exact ordering `model_driver.py`'s own comment calls out (:1636-1638:
  // "put an entry's `note` ahead of the reading it annotates"). Dropping this splice (i.e.
  // keeping only the later explicit `note`) silently reorders every multi-source
  // `cross_source_only[].reading.note` and any `_SpecEntry`/`ScrapedField` reading `note` —
  // caught by this module's own parity tests, not by inspection.
  'scraper_meta',
  'discovered_via', 'product_tags', 'catids', 'category_lists', 'scraper', 'generation',
  'created_at', 'emitted_at', 'subtitle', 'category', 'datasheet_fallback',
  'html_table_suppressed', 'manufacturer', 'manufacturer_datasheet', 'note',
  'power_standard', 'pdf_corroboration', 'ts_xcheck', 'distributor',
  // envelope keys
  'field', 'value', 'actual_reading', 'conformed_reading', 'conformed_by',
  'read_value', 'read_precision',
  'rejected',
  'origin', 'reading', 'readings', 'corroboration',
  'note', 'definition',
  // dq marks
  'kind', 'severity', 'rule', 'params',
  'computed', 'stored', 'off_pct',
  'formula', 'limit', 'unit',
  'detail', 'grounds', 'dq_marks',
  // curve payload
  'type', 'local_path', 'data_format', 'extracted_data_path',
];

const KEY_PRIORITY = new Map<string, number>();
for (const k of KEY_PRIORITY_LIST) if (!KEY_PRIORITY.has(k)) KEY_PRIORITY.set(k, KEY_PRIORITY.size);

/** Keys whose (scalar) list value renders as a flow sequence — model_driver.py:1642-1645
 *  (`_FLOW_LIST_KEYS`). `params` (model_driver.py:1662, `key == "params"`) renders as a flow
 *  MAPPING, handled separately below since it is a mapping key, not a list key. */
const FLOW_LIST_KEYS = new Set(['confirmed_fields', 'fields_with_issues', 'missing', 'invalid', 'parse_errors']);

function keyOrder(a: string, b: string): number {
  const pa = KEY_PRIORITY.get(a) ?? KEY_PRIORITY_LIST.length;
  const pb = KEY_PRIORITY.get(b) ?? KEY_PRIORITY_LIST.length;
  if (pa !== pb) return pa - pb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort a plain object's own keys into the canonical order, dropping `dq_marks: []`
 *  (model_driver.py:1665-1666: "an absent finding is absent") — recursively, matching
 *  `_canonicalise`'s dict branch. Arrays and scalars are left as-is; flow-style marking is
 *  applied afterward, over the built `yaml.Document`, in `markFlowStyle` below (this function
 *  only fixes VALUE/KEY shape and order, which is what a parity comparison after re-parsing
 *  actually depends on). */
function canonicaliseOrder(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(canonicaliseOrder);
  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj).sort(keyOrder);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (k === 'dq_marks' && Array.isArray(obj[k]) && (obj[k] as unknown[]).length === 0) continue;
      out[k] = canonicaliseOrder(obj[k]);
    }
    return out;
  }
  return node;
}

/** The mapping KEY a Map/Seq node is stored under, or `undefined` when its immediate parent
 *  is not a `Pair` (e.g. the document root, or a Seq item — this projection never needs a
 *  Seq item's own index).
 *
 *  `visit()`'s own `key` argument is NOT this — it is the node's ROLE in its immediate
 *  parent (`'key' | 'value' | number | null`; `number` is a Seq index), never the mapping
 *  key's text. A first version of this function compared that argument directly against
 *  `'params'`/`FLOW_LIST_KEYS`, which is exactly the comparison TypeScript's TS2367
 *  ("this comparison appears to be unintentional because the types ... have no overlap")
 *  reported as impossible — the fix silenced the parameter's type instead of heeding the
 *  diagnosis, so the comparison stayed dead code and no flow style was ever emitted. The
 *  real key lives one level up the visitor's `path`: `path[path.length - 1]` is the `Pair`
 *  this Map/Seq is the VALUE half of, and `pair.key` is a `Scalar` holding the key text. */
function ownerKey(path: readonly unknown[]): string | undefined {
  const owner = path[path.length - 1];
  if (owner instanceof Pair && isScalar(owner.key) && typeof owner.key.value === 'string') {
    return owner.key.value;
  }
  return undefined;
}

/** Mark `params` maps and the flow-list keys as flow-style on the built `yaml.Document` —
 *  model_driver.py:1662 (`FlowDict() if key == "params"`) and :1671-1673 (`FlowList` for
 *  `_FLOW_LIST_KEYS`, and for any `value` list whose items are all scalars). Cosmetic only:
 *  re-parsing a flow or block collection yields the identical JS value, so this does not
 *  affect the parse-and-compare parity check, only how closely the emitted text visually
 *  matches PyYAML's output — pinned separately, by literal substring, in this module's own
 *  test file. */
function markFlowStyle(doc: Document): void {
  visit(doc, {
    Map(_key, node: YAMLMap, path) {
      if (ownerKey(path) === 'params') node.flow = true;
    },
    Seq(_key, node: YAMLSeq, path) {
      const key = ownerKey(path);
      if (key !== undefined && FLOW_LIST_KEYS.has(key)) {
        node.flow = true;
        return;
      }
      if (key === 'value' && node.items.every((it) => isScalar(it))) {
        node.flow = true;
      }
    },
  });
}

function err(field: string, message: string): DriverError {
  return { level: 'error', field, message };
}

/** `driver.yml` text -> `openisd.yml` text. Paired with the Python `from_metadata`/`to_yaml`
 *  it replaces; `winisd_tools` calls this once per record via the embedded-V8 bridge. */
export function driverYamlToOpenisdYaml(yamlText: string): Result<string> {
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch (e) {
    return { value: null, errors: [err('yaml', `could not parse driver.yml: ${String(e)}`)] };
  }
  if (parsed == null || typeof parsed !== 'object') {
    return { value: null, errors: [err('yaml', 'driver.yml did not parse to a record')] };
  }
  const record = parsed as Partial<DriverYml>;

  const missingRequired = ['uuid', 'quality', 'manufacturer', 'brand', 'model', 'sku',
    'driver_type', 'data_sources', 'authoritative', 'specs']
    .filter((k) => !(k in record));
  if (missingRequired.length > 0) {
    return {
      value: null,
      errors: missingRequired.map((k) => err(k, `driver.yml is missing required field '${k}'`)),
    };
  }

  const model = record.model as DrScrapedField<string>;
  const series = record.series;
  const seriesStr = series?.value?.trim() ?? '';
  const conformedModel = [seriesStr, model.value].filter((p) => p.length > 0).join(' ');

  const openisd: Record<string, unknown> = {};
  for (const field of PASSTHROUGH_FIELDS) {
    if (record[field] !== undefined) openisd[field] = record[field];
  }
  openisd.model = { value: conformedModel, origin: model.origin, definition: model.definition };

  const ordered = canonicaliseOrder(openisd);
  const doc = new Document();
  doc.contents = doc.createNode(ordered);
  markFlowStyle(doc);
  return { value: doc.toString({ flowCollectionPadding: false }), errors: [] };
}
