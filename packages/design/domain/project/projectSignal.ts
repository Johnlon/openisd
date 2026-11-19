import type { SignalEngine, SignalIssue } from '../../engine/index.js';
import { DefaultingFieldImpl, DualWriteFieldImpl, absentCell, calculatedCell, enteredCell } from '../cell.js';
import type { SimpleField } from '../cell.js';
import { calculatedEntry, enteredEntry } from '../specEntry.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';
import { NumberField } from '../../fields/field.js';
import { fieldLoadRule, loadRepairText } from './loadRepair.js';
import type { LoadRepairRule } from './loadRepair.js';

/** The voltage a sweep runs at before anything is known. */
const DEFAULT_DRIVE_VOLTAGE_V = 1;
/** The lowest drive voltage a project may hold: 10 mV, the Driver input voltage box's own minimum. */
const MIN_DRIVE_VOLTAGE_V = NumberField.SIGNAL_DRIVEV_V.limits.min;
/** "the 10 mV minimum": how a message names that minimum (the field's own load repair). */
const MIN_DRIVE_DESCRIBED = describedMinimum();

function describedMinimum(): string {
    const repair = NumberField.SIGNAL_DRIVEV_V.loadRepair;
    if (repair === null) throw new Error(`${NumberField.SIGNAL_DRIVEV_V.value} must state its load repair`);
    return repair.described;
}

/** A project's own signal window (drive power/voltage), built fresh on every access — same
 *  reasoning as `driver`/`box`/`ProjectMeta`/`ProjectEnvironment`.
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
    readonly #driverWiring: () => 'parallel' | 'series';
    readonly #rgAtDriverSide: () => boolean;
    readonly #signalIssues: () => readonly SignalIssue[];

    constructor(
        lens: SimpleField<OpenISDProjectJson['signal']>,
        engine: SignalEngine,
        usableRe: () => number | null,
        rsOhm: () => number,
        winisdReWithoutRg: () => boolean,
        nDrivers: () => number,
        driverWiring: () => 'parallel' | 'series',
        rgAtDriverSide: () => boolean,
        signalIssues: () => readonly SignalIssue[],
    ) {
        this.#lens = lens;
        this.#engine = engine;
        this.#usableRe = usableRe;
        this.#rsOhm = rsOhm;
        this.#winisdReWithoutRg = winisdReWithoutRg;
        this.#nDrivers = nDrivers;
        this.#driverWiring = driverWiring;
        this.#rgAtDriverSide = rgAtDriverSide;
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
                    if (this.#usableRe() === null) {
                        throw new Error('powerDrive_W cannot be entered: the driver has no usable Re_ohm yet.');
                    }
                    // Refused, the previous value kept: the box's own bounds (`minimumPower_W`) say why.
                    if (this.powerDriveRefusal(v) !== '') return;
                    signal.set({...signal.value, power_W: enteredEntry(v), voltage_V: undefined});
                },
                // With Re known, the voltage stays as it reads and becomes the entered one.
                clear: () => {
                    const {voltage_V} = signal.value;
                    const keepVoltage = this.#usableRe() !== null && voltage_V !== undefined;
                    signal.set({...signal.value, power_W: undefined, voltage_V: keepVoltage ? enteredEntry(voltage_V.value) : voltage_V});
                },
                calculated: (v: number) => signal.set({...signal.value, power_W: calculatedEntry(v)}),
                dq: () => undefined,
            },
        );
    }

    /** The series resistance the power/voltage readout counts: Rg, or 0 with "Re without Rg"
     *  bug switch ticked (WinISD relates them through Re alone). */
    get readoutRs_ohm(): number {
        return this.#winisdReWithoutRg() ? 0 : this.#rsOhm();
    }

    /** Why a typed drive voltage is refused (below the 10 mV minimum, QO953.c21, c26); '' when it is taken. */
    driveVoltageRefusal(v: number): string {
        if (v >= MIN_DRIVE_VOLTAGE_V) return '';
        return `${NumberField.SIGNAL_DRIVEV_V.label} ${v} ${NumberField.SIGNAL_DRIVEV_V.unitLabel()} is below ${MIN_DRIVE_DESCRIBED}, so the previous value stays.`;
    }

    /** Why a typed drive power is refused (0 W or below, or a power that drives the amplifier below
     *  10 mV, QO953.c21, c26); '' when it is taken. Without a usable Re no power can be entered at all. */
    powerDriveRefusal(v: number): string {
        const Re_ohm = this.#usableRe();
        if (Re_ohm === null) return `${NumberField.SIGNAL_PIN_W.label} cannot be entered: the driver has no usable Re yet.`;
        if (v > 0 && this.#amplifierVoltageFor(v, Re_ohm, this.readoutRs_ohm) >= MIN_DRIVE_VOLTAGE_V) return '';
        return `${NumberField.SIGNAL_PIN_W.label} ${v} ${NumberField.SIGNAL_PIN_W.unitLabel()} drives below ${MIN_DRIVE_DESCRIBED}, so the previous value stays.`;
    }

    /** The smallest power the System input power box takes: its own minimum, or the power that drives
     *  10 mV when that is more. The box's minimum alone without a usable Re (the box is locked then). */
    get minimumPower_W(): number {
        const Re_ohm = this.#usableRe();
        if (Re_ohm === null) return NumberField.SIGNAL_PIN_W.limits.min;
        return Math.max(NumberField.SIGNAL_PIN_W.limits.min, this.#powerFor(MIN_DRIVE_VOLTAGE_V, Re_ohm));
    }

    /** The load repair rules of the drive level (`loadRepair.ts`), run once when a project opens:
     *  a voltage below 10 mV is set to 10 mV; an entered power of 0 W or below, or one driving below
     *  10 mV, is set to the power that drives 10 mV. The voltage is checked when it is the one
     *  entered, or when no power is entered to recalculate it from. */
    loadRepairRules(): readonly LoadRepairRule[] {
        const signal = this.#lens;
        const voltage = fieldLoadRule(NumberField.SIGNAL_DRIVEV_V,
            () => {
                const {voltage_V, power_W} = signal.value;
                if (voltage_V === undefined) return null;
                return voltage_V.state === 'E' || power_W?.state !== 'E' ? voltage_V.value : null;
            },
            v => {
                const {voltage_V} = signal.value;
                signal.set({...signal.value, voltage_V: voltage_V?.state === 'C' ? calculatedEntry(v) : enteredEntry(v)});
            });
        const power: LoadRepairRule = {
            field: NumberField.SIGNAL_PIN_W,
            loaded: () => {
                const {power_W} = signal.value;
                return power_W?.state === 'E' && this.#usableRe() !== null ? power_W.value : null;
            },
            breaks: v => this.powerDriveRefusal(v) !== '',
            fix: v => {
                const Re_ohm = this.#usableRe();
                if (Re_ohm === null) throw new Error('a power is repaired only against a usable Re');
                const P = this.#powerFor(MIN_DRIVE_VOLTAGE_V, Re_ohm);
                return {value: P, text: loadRepairText(NumberField.SIGNAL_PIN_W, v, `${NumberField.SIGNAL_PIN_W.format(P)} ${NumberField.SIGNAL_PIN_W.unitLabel()}, the power that drives ${MIN_DRIVE_DESCRIBED}`)};
            },
            write: v => signal.set({...signal.value, power_W: enteredEntry(v)}),
        };
        return [voltage, power];
    }

    /** The power this project's drivers draw at amplifier voltage `voltage_V` (the inverse of `#amplifierVoltageFor`). */
    #powerFor(voltage_V: number, Re_ohm: number): number {
        return this.#engine.powerFor(voltage_V, this.#nDrivers(), this.#driverWiring(), Re_ohm, this.readoutRs_ohm, this.#rgAtDriverSide());
    }

    /** The amplifier voltage that delivers `power_W` into this project's drivers, wired as chosen. */
    #amplifierVoltageFor(power_W: number, Re_ohm: number, rs_ohm: number): number {
        return this.#engine.amplifierVoltageFor(power_W, this.#nDrivers(), this.#driverWiring(), Re_ohm, rs_ohm, this.#rgAtDriverSide());
    }

    /** The amplifier voltage the sweep runs at (`eg`): `driveVoltage_V`, or with "Re without Rg"
     *  bug switch ticked, the voltage that drives the power read into Re + Rg — WinISD's SPL
     *  chart drives its Re-only power readout into Re + Rg. */
    get sweepVoltage_V(): number {
        const V = this.driveVoltage_V.value;
        const Re_ohm = this.#usableRe();
        const power_W = this.powerDrive_W.value;
        if (!this.#winisdReWithoutRg() || Re_ohm === null || power_W === null) return V;
        return this.#amplifierVoltageFor(power_W, Re_ohm, this.#rsOhm());
    }

    /**
     * The drive voltage each driver gets — the `eg` every sweep runs at (see `sweepVoltage_V`). Never absent: an empty slot reads
     * `DEFAULT_DRIVE_VOLTAGE_V` as calculated, and it is never below 10 mV: a typed one is refused,
     * a loaded one repaired on opening (`loadRepairRules`). Entering it needs no
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
                    // Refused, the previous value kept: the box's own bounds say why.
                    if (this.driveVoltageRefusal(v) !== '') return;
                    signal.set({...signal.value, voltage_V: enteredEntry(v), power_W: undefined});
                },
                // With Re known, the power stays as it reads and becomes the entered one.
                clear: () => {
                    const {power_W} = signal.value;
                    const keepPower = this.#usableRe() !== null && power_W !== undefined;
                    signal.set({...signal.value, voltage_V: undefined, power_W: keepPower ? enteredEntry(power_W.value) : undefined});
                },
                calculated: (v: number) => signal.set({...signal.value, voltage_V: calculatedEntry(v)}),
                dq: () => undefined,
            },
        );
    }
}
