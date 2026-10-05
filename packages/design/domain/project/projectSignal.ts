import type { SignalEngine, SignalIssue } from '../../engine/index.js';
import { DefaultingFieldImpl, DualWriteFieldImpl, absentCell, calculatedCell, enteredCell, focus, writeEntryDq } from '../cell.js';
import type { SimpleField } from '../cell.js';
import { calculatedEntry, enteredEntry } from '../specEntry.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';

/** The voltage a sweep runs at before anything is known. */
const DEFAULT_DRIVE_VOLTAGE_V = 1;
/** The lowest drive voltage a project may hold: 10 mV, the smallest the UI's 2 dp shows. */
const MIN_DRIVE_VOLTAGE_V = 0.01;

/** A project's own signal window (drive power/voltage), built fresh on every access — same
 *  reasoning as `driver`/`box`/`ProjectMeta`/`ProjectEnvironment` (PLAN_openisdproject_split.md).
 *  `usableRe`/`rsOhm`/`signalIssues` are passed in rather than reached for: the facade already
 *  knows how to build them (`driverOver`, the public `Rs_ohm` field, `#issues.signal`), and this
 *  class has no business constructing a driver window of its own. */
export class ProjectSignal {
    readonly #lens: SimpleField<OpenISDProjectJson['signal']>;
    readonly #engine: SignalEngine;
    readonly #usableRe: () => number | null;
    readonly #rsOhm: () => number;
    readonly #winisdReWithoutRg: () => boolean;
    readonly #nDrivers: () => number;
    readonly #signalIssues: () => readonly SignalIssue[];

    constructor(
        lens: SimpleField<OpenISDProjectJson['signal']>,
        engine: SignalEngine,
        usableRe: () => number | null,
        rsOhm: () => number,
        winisdReWithoutRg: () => boolean,
        nDrivers: () => number,
        signalIssues: () => readonly SignalIssue[],
    ) {
        this.#lens = lens;
        this.#engine = engine;
        this.#usableRe = usableRe;
        this.#rsOhm = rsOhm;
        this.#winisdReWithoutRg = winisdReWithoutRg;
        this.#nDrivers = nDrivers;
        this.#signalIssues = signalIssues;
    }

    /** The drive power — WinISD's Signal-tab "System input power", shared by all N drivers. While
     *  the driver has a usable Re, `power_W = N · voltage_V² / Re` holds and whichever of the pair was entered last is entered;
     *  the other is calculated. Without a usable Re it is not available and cannot be entered —
     *  its dq names the missing Re. */
    get powerDrive_W(): DualWriteFieldImpl<number> {
        const signal = this.#lens;
        return new DualWriteFieldImpl<number>(
            () => {
                const entry = signal.value.power_W;
                if (entry === undefined) return absentCell<number>('power_W', this.#signalIssues());
                return entry.state === 'E'
                    ? enteredCell<number | null>('power_W', entry.value)
                    : calculatedCell<number | null>('power_W', entry.value);
            },
            {
                entered: (v: number) => {
                    const Re_ohm = this.#usableRe();
                    if (Re_ohm === null) {
                        throw new Error('powerDrive_W cannot be entered: the driver has no usable Re_ohm yet.');
                    }
                    if (!(v > 0 && this.#engine.driveVoltage(v / this.#nDrivers(), Re_ohm, this.readoutRs_ohm) >= MIN_DRIVE_VOLTAGE_V)) {
                        throw new RangeError(`powerDrive_W ${v} W drives below the 10 mV minimum voltage.`);
                    }
                    signal.set({...signal.value, power_W: enteredEntry(v), voltage_V: undefined});
                },
                // With Re known, the voltage stays as it reads and becomes the entered one.
                clear: () => {
                    const {voltage_V} = signal.value;
                    const keepVoltage = this.#usableRe() !== null && voltage_V !== undefined;
                    signal.set({...signal.value, power_W: undefined, voltage_V: keepVoltage ? enteredEntry(voltage_V.value) : voltage_V});
                },
                calculated: (v: number) => signal.set({...signal.value, power_W: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'power_W'), list),
            },
        );
    }

    /** The series resistance the power/voltage readout counts: Rg, or 0 with "Enable WinISD Re
     *  without Rg bug" ticked (WinISD relates them through Re alone). */
    get readoutRs_ohm(): number {
        return this.#winisdReWithoutRg() ? 0 : this.#rsOhm();
    }

    /** The voltage each driver gets in the sweep: `driveVoltage_V`, or with "Enable WinISD Re
     *  without Rg bug" ticked, the voltage that drives the power read into Re + Rg — WinISD's SPL
     *  chart drives its Re-only power readout into Re + Rg. */
    get sweepVoltage_V(): number {
        const V = this.driveVoltage_V.value;
        const Re_ohm = this.#usableRe();
        const power_W = this.powerDrive_W.value;
        if (!this.#winisdReWithoutRg() || Re_ohm === null || power_W === null) return V;
        return this.#engine.driveVoltage(power_W / this.#nDrivers(), Re_ohm, this.#rsOhm());
    }

    /**
     * The drive voltage each driver gets — the `eg` every sweep runs at (see `sweepVoltage_V`). Never absent: an empty slot reads
     * `DEFAULT_DRIVE_VOLTAGE_V` as calculated, and it is never below 10 mV. Entering it needs no
     * Re. `.clear()` empties the pair; the resolve then fills it back from its defaults.
     */
    get driveVoltage_V(): DefaultingFieldImpl<number> {
        const signal = this.#lens;
        return new DefaultingFieldImpl<number>(
            () => {
                const entry = signal.value.voltage_V;
                if (entry === undefined) return calculatedCell('voltage_V', DEFAULT_DRIVE_VOLTAGE_V);
                return entry.state === 'E'
                    ? enteredCell('voltage_V', entry.value)
                    : calculatedCell('voltage_V', entry.value);
            },
            {
                entered: (v: number) => {
                    if (!(v >= MIN_DRIVE_VOLTAGE_V)) throw new RangeError(`driveVoltage_V ${v} V is below the 10 mV minimum.`);
                    signal.set({...signal.value, voltage_V: enteredEntry(v), power_W: undefined});
                },
                clear: () => signal.set({...signal.value, voltage_V: undefined, power_W: undefined}),
                calculated: (v: number) => signal.set({...signal.value, voltage_V: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'voltage_V'), list),
            },
        );
    }
}
