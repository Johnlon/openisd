/* eslint-disable @typescript-eslint/no-unused-vars */
import { Engine } from '../../engine/index.js';
import type { Air, AirEnvironment, DriverError, DriverIssue, DriverSolverParams } from '../../engine/index.js';
import { realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { ReadableFieldImpl, SetOnlyFieldImpl, absentCell, enteredCell, resolvingField } from '../cell.js';
import type { Entered, Readable, SimpleField, Writable } from '../cell.js';
import { openIsdDriverToWinIsdDriver, winIsdDriverTextToOpenIsdDriver } from '../driverYmlToOpenisdAndWdr.js';
import { newUuid } from '../newUuid.js';
import { OpenISDDeviceJson, asDriverDevice, driverSpecsOf, winningValue } from '../openisdSchema.js';
import type { DriverDeviceJson } from '../openisdSchema.js';
import { blankDeviceRecord } from './blankDeviceRecord.js';
import { driverSolverParamsOf } from './driverSolverParamsOf.js';
import { OpenISDDevice } from './openISDDevice.js';
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
     *  TODO(bugs/BUG_20260907_driver_type_has_no_closed_set_shared_with_python.md): this is a
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

    protected constructor(
        record: SimpleField<DriverDeviceJson>,
        engine: Engine,
        airProvider: () => AirEnvironment,
        /** See `OpenIsdDriverSpec`'s own parameter — only an embedded driver supplies one. */
        durableIssues?: () => readonly DriverIssue[],
    ) {
        super(record, engine);
        this.record = record;
        this.airProvider = airProvider;
        const air = (): Air => engine.solveEnvironment(airProvider()).values;
        this.specs = new OpenIsdDriverSpec(record, 'woofer', engine, air, durableIssues);
    }

    /** T11/S2-7c: resolve this driver's spec — write every derivable quantity back
     *  into the record as a `'C'` entry, cache the issues, and return them. */
    resolve(): readonly DriverIssue[] {
        return this.specs.resolve(this.engine.solveEnvironment(this.airProvider()).values);
    }

    // ── DERIVED FIGURES — every one from the injected engine, none computed here ──────────────

    /** `ts`, shaped as `DriverSolverParams` — for a caller (the UI's chart layer, `Design.driver`)
     *  that needs the full 44-handle surface `Engine.sweep()`/`maxCurves()` take, not just the
     *  live spec window. See `driverSolverParamsOf`'s own doc for which four members are adapted
     *  rather than reused. */
    get solverParams(): DriverSolverParams {
        return driverSolverParamsOf(this.specs, this.engine);
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

    /** Voice-coil inductance, as the record states it. Not a solver quantity — nothing derives it
     *  — so it travels to `sweep` on its own, for the impedance plot alone. */
    Le_H(): number | null {
        return winningValue(driverSpecsOf(this.record.value)?.woofer?.Le_H);
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

    /** This driver as WinISD `.wdr` text — the form `OpenISDDriver.fromWdrIniText` reads back.
     *
     *  `.wdr` states far less than an openisd record does: a field WinISD has no key for is
     *  dropped, so this is a lossy write and the round trip is not an identity. `errors` carries
     *  every such loss the converter reported. */
    toWdrIniText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const errors: DriverError[] = [];
        const wdr = openIsdDriverToWinIsdDriver(this, errors);
        return {value: wdr.toWdrIni(), errors};
    }

    /** WinISD `.wdr` text back to a driver. The inverse of `toWdrIniText()`, as far as a format
     *  carrying fewer fields allows. */
    static fromWdrIniText(text: string, engine: Engine): { value: OpenISDDriver | null; errors: DriverError[] } {
        return winIsdDriverTextToOpenIsdDriver(text, engine);
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
     *  (`conformingRecordToDriver`, tests, `driverYmlToOpenisdAndWdr.ts`) passes none. A caller
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
