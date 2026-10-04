import {type Engine} from '../../engine/index.js';
import type { Air, AirEnvironment, DriverError, DriverIssue, EbpSuitability, VentedAlignment, VentedDesign } from '../../engine/index.js';
import { realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { ReadableFieldImpl, SetOnlyFieldImpl, absentCell, enteredCell, resolvingField } from '../cell.js';
import type { Calculated, Clearable, Entered, Precise, Readable, SimpleField, Writable } from '../cell.js';
import { winIsdDriverConverter } from '../winIsdDriverConverter.js';
import { newUuid } from '../newUuid.js';
import { asDriverDevice } from '../openisdSchema.js';
import type { DriverDeviceJson } from '../openisdSchema.js';
import { OpenISDDeviceJson } from '../openIsdDeviceJsonIo.js';
import { blankDeviceRecord } from './blankDeviceRecord.js';
import { OpenISDDevice } from './openISDDevice.js';
import type { NumericDriverSpecFieldName } from './driverSpecFieldName.js';
import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';

/**
 * A real, playable driver — its record has a `woofer` or `tweeter` section.
 *
 * ABSTRACT, with two concrete kinds, because "a driver in a project" and "a driver on its own"
 * are genuinely different things and the type should say so rather than one class carrying a
 * nullable project:
 *   - `OpenISDDriverEmbedded` — part of an `OpenISDProject`, holds a reference to it, and can be
 *     REPLACED wholesale via `update()`.
 *   - `OpenISDDriverStandalone` — a My Drivers entry, a bundle row, or a detached copy. No
 *     project, because it is not in one.
 * Both are WINDOWS onto a record living wherever their owner keeps it — never an internal copy.
 *
 * Neither constructs from a record with no woofer/tweeter section: a record that incomplete
 * never becomes a driver at all, it is rejected before a window is opened onto it. (Flagging
 * such a record in the driver list and refusing selection is the app's job, outside this
 * package — this refusal is the safety net that check relies on, not a duplicate of it.) So
 * every field below can assume its spec section exists for the instance's whole lifetime.
 *
 * Every `Field` is built ONCE, eagerly, in the constructor, not lazily per getter access — a
 * lazy `get Fs_hz()` allocates a new `Field` per access, so `driver.Fs_hz !== driver.Fs_hz`,
 * which breaks object-identity-based reactivity by making every read look like a change.
 * Building once makes the identity stable for the instance's lifetime, while `.value` still
 * reads live off `read()` every call — the closures capture `this` and dereference at CALL
 * time, never a json snapshot, which is what makes eager construction safe even though
 * `write()` REASSIGNS the record.
 */

const NOT_A_DRIVER = 'no woofer section — this record is a passive radiator, nothing to simulate';

export abstract class OpenISDDriver extends OpenISDDevice {
    static fromConformingRecord(record: unknown, engine: Engine): OpenISDDriver | string[] {
        const conformed = OpenISDDeviceJson.fromConformingRecord(record);
        if ('problems' in conformed) return conformed.problems;

        const driver = asDriverDevice(conformed.json);
        if (driver === null) return [NOT_A_DRIVER];
        return OpenISDDriverStandalone.wrap(driver, engine);
    }

    /** A driver stating nothing — what the editor opens on "create a new driver from scratch".
     *  Every spec field reads `not-available`, so the editor renders it blank and the consistency
     *  solver has nothing to work from until the user types. No conformance check: this record is
     *  minted here, not received from outside, so there is no untrusted input to refuse. */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDDriver {
        return OpenISDDriverStandalone.wrap(blankDeviceRecord({woofer: {}}, 'woofer', appContext), engine);
    }

    /** `.owdr` text — openisd driver JSON — back to a driver, or the reasons it could not be
     *  read. The inverse of `toOwdrText()`. */
    static fromOwdrText(text: string, engine: Engine): OpenISDDriver | string[] {
        const parsed = OpenISDDeviceJson.fromOpenisdDriverJson(text);
        if ('problems' in parsed) return parsed.problems;

        const driver = asDriverDevice(parsed.json);
        if (driver === null) return [NOT_A_DRIVER];
        return OpenISDDriverStandalone.wrap(driver, engine);
    }

    /** This driver's spec fields — the woofer section. Driver math is woofer-only in OpenISD; a
     *  coaxial's tweeter section stays in the record but has no handle. `OpenIsdDriverSpec`
     *  structurally satisfies `DriverSolverParams` (44 `Field`s + `wiring`). */
    readonly specs: OpenIsdDriverSpec;

    /** The scraper-stated classification string — driver only, so it lives here rather than on
     *  `OpenISDDevice` alongside `brand`/`model`, which a box or radiator also carries. Read-only:
     *  a plain accessor, not a `Field`, because nothing writes this — it is scraper-owned data
     *  (`scrapedFieldOf`), not a value an editor enters.
     *
     *  Every value seen across the driver.yml corpus: "woofer", "subwoofer", "midrange",
     *  "mid-bass", "mid-woofer", "full-range", "coaxial", "tweeter", "amt", "passive-radiator".
     *
     *  TODO(bugs/archive/BUG_20260907_driver_type_has_no_closed_set_shared_with_python.md): this is a
     *  closed vocabulary (`driver.yml`'s own field comment says so) with no enum backing it on
     *  either side of the scraper/domain boundary. Once one exists, shared with the Python
     *  scraper the way `filter/driverType.ts` keeps `DriverType`/`Chip` in parity with
     *  `test_driver_type_enum_parity.py`, this method returns that domain type instead of the raw
     *  string — not `packages/design/filter`'s `DriverType`, which is a UI/search-only concept. */
    driverType(): string {
        return this.record.value.driver_type.value;
    }

    /** A driver's record is never absent, so this stays non-null for everything below. */
    protected readonly record: SimpleField<DriverDeviceJson>;

    /** The air THIS driver falls back to when it states no `c`/`roo` of its own — an embedded
     *  driver's is the project's own live environment (`OpenISDDriverEmbedded.wrap()`); a
     *  standalone driver's defaults to the reference condition. `resolve()` reads it fresh on
     *  every call, so a project's environment changing is picked up the next time it runs. */
    protected readonly airProvider: () => AirEnvironment;

    /** The one calculation surface. INJECTED, exactly as `OpenISDProject`'s is — a driver reports
     *  derived figures, and every one of them comes from here and nowhere else. */
    protected readonly engine: Engine;

    protected constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirEnvironment,
        /** See `OpenIsdDriverSpec`'s own parameter — only an embedded driver supplies one. */
        durableIssues?: () => readonly DriverIssue[],
    ) {
        super(record);
        this.engine = engine;
        this.record = record;
        this.airProvider = airProvider;
        const air = (): Air => engine.environment.solve(airProvider()).values;
        this.specs = new OpenIsdDriverSpec(record, 'woofer', engine.driver, engine.issues, air, durableIssues);
    }

    /** T11/S2-7c: resolve this driver's spec — write every derivable quantity back
     *  into the record as a `'C'` entry, cache the issues, and return them. */
    resolve(): readonly DriverIssue[] {
        return this.specs.resolve(this.engine.environment.solve(this.airProvider()).values);
    }

    // ── DERIVED FIGURES — every one from the injected engine, none computed here ──────────────

    /** `field`'s handle, for a caller holding a NAME rather than a member — the editor's
     *  data-driven field table, which reads, writes and clears through the one it gets back.
     *  Total: every numeric spec name has a handle, so there is no null to check for. */
    specField(field: NumericDriverSpecFieldName):
        Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable {

        return this.specs[field];
    }

    /** Everything this driver's stated values disagree about — an over-specified driver whose
     *  numbers cannot all be true at once — or cannot yet derive, because too few of a group
     *  (e.g. Qts's Qes/Qms pair) are stated. Empty when consistent and fully solvable.
     *
     *  T11/S2-7c: the cached result of the last `resolve()` — entered-only by construction,
     *  since `resolve()`'s own working set feeds the engine only entered values (never a
     *  calculated one fed back as if it had been typed, or the group could never be reported as
     *  inconsistent no matter how wrong the user's OWN numbers are). */
    issues(): readonly DriverIssue[] {
        return this.specs.issues();
    }

    /** What actually blanks a chart: a quantity the solver cannot derive, or a mandatory field
     *  with no value. Never merged with `inconsistentInputReasons()`: a missing Brand does not
     *  blank a chart, and values that merely disagree blank nothing at all — every value an
     *  `inconsistent-inputs` issue names is present and plotted as stated
     *  (BUG_20260924_inconsistent-inputs-claims-charts-blank). */
    chartBlockingReasons(): readonly DqReason[] {
        const reasons: DqReason[] = this.issues().flatMap(issue => {
            // No default arm: a new `CalculationIssue` variant fails to compile here rather than
            // silently joining this list.
            switch (issue.kind) {
                case 'missing-dependencies':
                    return [{subject: issue.target, text: `cannot be calculated yet — needs ${issue.routes.map(r => r.missing.join(', ')).join(' or ')}`}];
                case 'inconsistent-inputs':
                case 'out-of-range':
                    return [];
            }
        });
        const mandatoryFields: readonly NumericDriverSpecFieldName[] = ['Fs_hz', 'Vas_m3', 'Re_ohm', 'Sd_m2'];
        for (const field of mandatoryFields) {
            if (this.specs[field].value === null) reasons.push({subject: field, text: 'is not set'});
        }
        return reasons;
    }

    /** Qts as the amplifier's source impedance `Rs_ohm` loads it: `Rs` folded into Qes. The bare
     *  Qts when Qms/Qes/Re cannot be resolved; null when Qts cannot. `Rs` is a parameter because
     *  the driver record has no home for it — it is the project's fact. */
    sourceLoadedQts(Rs_ohm: number): number | null {
        const ts = this.specs;
        const Qts = ts.Qts.value;
        if (Qts === null) return null;
        return this.engine.driver.sourceLoadedQts(
            ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN, Rs_ohm, Qts);
    }

    /** Efficiency bandwidth product, Fs/Qes. Null without Fs or Qes, or for Qes = 0. */
    ebp(): number | null {
        const Fs_hz = this.specs.Fs_hz.value, Qes = this.specs.Qes.value;
        return Fs_hz !== null && Qes !== null && Qes !== 0 ? this.engine.driver.ebp(Fs_hz, Qes) : null;
    }

    /** Which box type the EBP rule of thumb prefers; null when `ebp()` is. */
    ebpSuitability(): EbpSuitability | null {
        const ebp = this.ebp();
        return ebp !== null ? this.engine.driver.ebpSuitability(ebp) : null;
    }

    /** The Qtc a sealed box of `volume_m3` gives this driver. Null without Qts/Vas or for a
     *  non-positive volume. */
    sealedQtc(volume_m3: number): number | null {
        const Qts = this.specs.Qts.value, Vas_m3 = this.specs.Vas_m3.value;
        return Qts !== null && Vas_m3 !== null && volume_m3 > 0
            ? this.engine.sealed.qtcFromVolume(Qts, Vas_m3, volume_m3) : null;
    }

    /** The sealed volume that gives this driver `targetQtc`. Null without Qts/Vas. */
    sealedVolumeForQtc(targetQtc: number): number | null {
        const Qts = this.specs.Qts.value, Vas_m3 = this.specs.Vas_m3.value;
        return Qts !== null && Vas_m3 !== null ? this.engine.sealed.volumeForQtc(Qts, Vas_m3, targetQtc) : null;
    }

    /** The vented box `alignment` designs for this driver as driven through `Rs_ohm` with box
     *  losses `Ql` — WinISD designs for the source-loaded Qts, not the datasheet Qts. Null
     *  without Fs/Qts/Vas. */
    ventedDesign(alignment: VentedAlignment, Rs_ohm: number, Ql: number): VentedDesign | null {
        const Fs_hz = this.specs.Fs_hz.value, Vas_m3 = this.specs.Vas_m3.value;
        const QtsLoaded = this.sourceLoadedQts(Rs_ohm);
        if (Fs_hz === null || Vas_m3 === null || QtsLoaded === null) return null;
        return this.engine.vented.alignment(alignment, Fs_hz, QtsLoaded, Vas_m3, Ql);
    }

    /** Stated values that contradict each other, each stated against what the other stated
     *  values imply. Every value involved exists and every chart plots from the values AS
     *  STATED — a data-quality conflict to resolve, not a blocker. */
    inconsistentInputReasons(): readonly DqReason[] {
        return this.issues().flatMap(issue => {
            switch (issue.kind) {
                case 'inconsistent-inputs':
                    return [{subject: issue.target, text: `${issue.formula} — stated as ${issue.actual}, the others imply ${issue.expected}`}];
                case 'missing-dependencies':
                case 'out-of-range':
                    return [];
            }
        });
    }

    /** An INDEPENDENT driver carrying this one's current values — and, with `update()`, the whole
     *  of how an editor works: take a copy, let the user edit THAT, and on OK write it back with
     *  `update()`; on Cancel simply drop it. The original never sees an intermediate value, so
     *  Cancel needs no layer, no session object and no adapter, and the same code serves an
     *  embedded driver and a standalone one alike — which is what a generic editor wants. What makes "Save to My Drivers",
     *  "edit a bundle entry" and "fork this entry" possible without any of them reaching into the
     *  storage this window points at. Always STANDALONE — a copy belongs to nothing until
     *  something adopts it (via `OpenISDDriverEmbedded.update()`, or a repo save). */
    detach(): OpenISDDriverStandalone {
        return OpenISDDriverStandalone.wrap(structuredClone(this.record.value), this.engine);
    }

    /** An independent standalone copy with a new record identity. Used when a driver crosses into
     * a new owner, such as a project embedding or an explicit user copy. */
    copyAsNew(): OpenISDDriver {
        const copy = this.cloneDriver();
        copy.uuid = { value: newUuid() };
        return OpenISDDriverStandalone.wrap(copy, this.engine);
    }

    /** @internal The record a save writes, deep-cloned. Same seam as
     *  `OpenISDProject.cloneProject()` — the persistence layer's one way to reach the raw record
     *  it stores, never field by field. Clones before handing it out, so the caller can store or
     *  hand the result elsewhere without aliasing this driver's own live record — a shallow
     *  `{...}` spread is not enough, since every nested field object (`brand`, `driver_type`,
     *  `specs.woofer.Fs`, …) would still be the same reference as the live record. */
    cloneDriver(): DriverDeviceJson {
        return structuredClone(this.record.value);
    }

    /** Replace this driver's whole record with `source`'s current values. The write-back
     *  primitive: a project adopting a different driver, or an edit made on a detached copy being
     *  put back.
     *
     *  Reads `source.record` directly. Legal because `record` is PROTECTED and this method belongs
     *  to the class that declares it, so one driver may read another's — and no consumer can,
     *  because a protected member is not on the public surface.
     *
     *  Deep-cloned: after this call the two records share no nested object, so neither driver's
     *  later edits reach the other regardless of how the storage layer applies writes. */
    update(source: OpenISDDriver): void {
        this.record.set(structuredClone(source.record.value));
    }

    /** Make this driver a copy: its `model` states so, so `<brand>/<model>` differs from the
     *  driver it was copied from and the two stand side by side rather than one replacing the
     *  other. Called on a detached copy, before it is saved; a copy is a new record identity. */
    renameToCopy(): void {
        this.model.set('Copy of ' + this.model.value);
        const copy = this.cloneDriver();
        copy.uuid = { value: newUuid() };
        this.record.set(copy);
    }

    /** The stable identity carried by the canonical driver record. */
    uuid(): string {
        return this.record.value.uuid.value;
    }

    /** The product series this driver belongs to (e.g. "Reference Series"), or null. Descriptive
     *  only — the picker's preview text, never a simulated quantity. Null when the record omits
     *  it. */
    get series(): Readable<string | null> {
        return new ReadableFieldImpl<string | null>(() => {
            const v = this.record.value.series?.value ?? null;
            return v === null ? absentCell<string>('series') : enteredCell<string | null>('series', v);
        });
    }

    /** The manufacturer's own part number — scraper-derived for a bundled record, editor-entered
     *  for a My Driver. `sku` is `derivedFieldOf(z.string())` — schema-guaranteed, `.value`
     *  typed `string`, never null, unlike `series`/`description`, and with no "not entered"
     *  state to clear to: emptying it is `set('')`, the same as `brand`/`model`. */
    get sku(): Readable<string> & Entered & Writable<string> {
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('sku', this.record.value.sku.value),
            {
                entered: (v: string) => {
                    this.record.set({...this.record.value, sku: {value: v, grounds: [{origin: 'manual', reading: v}]}});
                },
            },
        );
    }

    /** Free-text description from the datasheet, or null. Preview text only. */
    get description(): Readable<string | null> {
        return new ReadableFieldImpl<string | null>(() => {
            const v = this.record.value.description?.value ?? null;
            return v === null ? absentCell<string>('description') : enteredCell<string | null>('description', v);
        });
    }

    toOpenIsdDeviceJson(): DriverDeviceJson {
        return this.record.value;
    }

    /** This driver as `.owdr` text — openisd driver JSON, the form `OpenISDDriver.fromOwdrText` reads
     *  back. The serialisation stays inside the domain so the record type never crosses the
     *  package boundary. */
    toOwdrText(): string {
        return OpenISDDeviceJson.toOpenisdDriverJson(this.record.value);
    }

    /** This driver as WinISD `.wdr` text — the form `WinIsdDriverConverter.winIsdDriverToOpenIsdDriver` reads back.
     *
     *  `.wdr` states far less than an openisd record does: a field WinISD has no key for is
     *  dropped, so this is a lossy write and the round trip is not an identity. `errors` carries
     *  every such loss the converter reported. */
    toWdrIniText(): { value: string | null; errors: DriverError[] } {
        const errors: DriverError[] = [];
        const wdr = winIsdDriverConverter(this, errors);
        return {value: wdr.toWdrIni(), errors};
    }

}

// `OpenISDDriverStandalone` stays in THIS file, alongside its base — never its own module. Their
// static methods (`OpenISDDriver.empty()`/`fromConformingRecord()`/`fromOwdrText()`/`detach()`
// all delegate to `OpenISDDriverStandalone.wrap()`) and its `extends OpenISDDriver` clause make
// each a compile-time dependency of the other. Splitting them into separate files makes that a
// circular MODULE import: whichever file loads first hits `extends OpenISDDriver` (or a static
// call on `OpenISDDriverStandalone`) before the other module has finished evaluating —
// `TypeError: Class extends value undefined is not a constructor or null`, reproduced by
// `npx vitest run packages/design/test/domain.test.ts` when the two lived in separate files.
// Kept together, the cycle never crosses a module boundary.

/** A driver that belongs to no project — a My Drivers entry, a bundle row, a detached copy.
 *  `wrap()` windows onto a record the caller owns; the record is not copied, it is referenced.
 *
 *  `export`ed for `openisdTransforms.ts` (`conformingRecordToOpenIsdDriver` calls `wrap()`);
 *  `domain/index.ts` does not re-export it, so no consumer outside `packages/design` sees it. */
/** One data-quality reason: `subject` is the field name to highlight, `text` the rest of the
 *  sentence. Kept apart so a renderer can show the subject distinctly without scraping it back
 *  out of an assembled sentence. */
export interface DqReason {
    readonly subject: string;
    readonly text: string;
}

export class OpenISDDriverStandalone extends OpenISDDriver {
    /** ON: every write derives, as `resolve()` always did before this flag existed. OFF: a
     *  write still lands (`entered`/`clear` on the record), but `resolve()` stops deriving —
     *  every field, entered or calculated, stays frozen at whatever it currently reads, so
     *  clearing one no longer pulls another back in behind it. The driver editor's own setting
     *  (John, 2026-09-24): nothing else in the app calls `setAutoCalculate`. */
    #autoCalculate = true;

    get autoCalculate(): boolean {
        return this.#autoCalculate;
    }

    /** Flipping ON resolves immediately, catching up on every write made while OFF in one pass —
     *  the same as re-ticking WinISD's own checkbox. Flipping OFF makes no write of its own: the
     *  fields already hold whatever they last held. */
    setAutoCalculate(enabled: boolean): void {
        this.#autoCalculate = enabled;
        if (enabled) this.resolve();
    }

    /** OFF: skip the derive, return the last resolve's cached issues untouched. */
    override resolve(): readonly DriverIssue[] {
        return this.#autoCalculate ? super.resolve() : this.issues();
    }

    /** `airProvider` defaults to the reference environment — every existing caller
     *  (`conformingRecordToDriver`, tests, `winIsdDriverConverter.ts`) passes none. A caller
     *  holding an app-level environment (the UI, constructing a My Drivers row) passes its own. */
    static wrap(
        json: DriverDeviceJson,
        engine: Engine,
        airProvider: () => AirEnvironment = () => ({}),
    ): OpenISDDriverStandalone {
        let current = json;
        const raw: SimpleField<DriverDeviceJson> = {
            get value() { return current; },
            set: (j) => {
                current = j;
            },
        };
        // S2-7c: every write resolves from here on — a solve's own `setCalculated` writes
        // travel through this same lens and must not re-trigger (`resolvingField`'s reentrancy
        // guard). `driver` is assigned before `onWrite` can ever run: the guarded callback only
        // fires from a `.set()` call, and construction itself performs none (see the base
        // constructor's own note on why it does not resolve itself).
        // eslint-disable-next-line prefer-const
        let driver!: OpenISDDriverStandalone;
        const record = resolvingField(raw, () => driver.resolve());
        driver = new OpenISDDriverStandalone(record, engine, airProvider);
        // The one-shot cache-on-load (S7-d): a standalone driver is a genuine single long-lived
        // instance, so — unlike an embedded one, rebuilt fresh on every access — resolving once
        // here is exactly the "'C' is a cache, recomputed on load" contract, not a write-on-read
        // hazard. Goes through the wrapped lens like any other write, so it is guarded the same
        // way and reachable from `driver.resolve()` above without recursing.
        driver.resolve();
        return driver;
    }

}
