import type {BoxType} from '../../engine/index.js';
import {BOX_TYPE_OPTIONS} from '../../fields/options.js';
import {NumberField} from '../../fields/field.js';
import {decimalsIn} from '../../fields/dimensions.js';
import {formatFixed} from '../../fields/format.js';
import type {OpenISDProject} from './openISDProject.js';

/** The box's air volume: one cabinet, or the rear and front chambers of a two-chamber box.
 *  `null` is a volume the owner left blank. */
export type SummaryVolume =
    | { readonly kind: 'one'; readonly volume_m3: number | null }
    | { readonly kind: 'two'; readonly rear_m3: number | null; readonly front_m3: number | null };

/** Places shown for a volume in litres; other units scale from it. */
const VOLUME_DECIMALS_IN_LITRES = 1;

/** A project at a glance, for the Open project list: its driver, box type and box volume. */
export class ProjectSummary {
    private constructor(
        /** The driver's brand and model. */
        readonly driver: string,
        readonly boxType: BoxType,
        readonly volume: SummaryVolume,
        /** The driver's short code (its sku); '' when it has none. */
        readonly code: string,
    ) {}

    static of(project: OpenISDProject): ProjectSummary {
        const box = project.box;
        const type = box.boxType.value;
        const main_m3 = box.volumeOf(type).value;
        const front = box.frontVolumeOf(type);
        const volume: SummaryVolume = front === null
            ? {kind: 'one', volume_m3: main_m3}
            : {kind: 'two', rear_m3: main_m3, front_m3: front.value};
        const driver = [project.driver.brand.value, project.driver.model.value].filter(s => s.length > 0).join(' ');
        return new ProjectSummary(driver, type, volume, project.driver.sku.value);
    }

    /** "Tang Band W5-1138SMF · Vented · 12.0 L": the box type as the Box tab names it, the volume
     *  in the unit `unitTokens` holds for the box volume (rear + front for a two-chamber box). */
    line(unitTokens: Readonly<Record<string, string>>): string {
        return this.lineWith(this.driver, unitTokens);
    }

    /** "E150HE-44 · Closed · 3.5 L": as `line`, with the driver's sku upper-cased in place of its
     *  brand and model; a driver with no sku shows the brand and model (QO259). */
    phoneLine(unitTokens: Readonly<Record<string, string>>): string {
        return this.lineWith(this.code.length > 0 ? this.code.toUpperCase() : this.driver, unitTokens);
    }

    /** Separate display lines for a project card, using the same units as the full summary. */
    boxDetails(unitTokens: Readonly<Record<string, string>>): {readonly type: string; readonly volumes: string} {
        const field = NumberField.BOX_VB_L;
        const token = field.unitTokenFor(unitTokens);
        const decimals = decimalsIn(field.unitFor(token), VOLUME_DECIMALS_IN_LITRES);
        const shown = (v_m3: number | null): string => v_m3 !== null && isFinite(v_m3) ? formatFixed(field.toDisplay(v_m3, token), decimals) : '—';
        const amount = this.volume.kind === 'one'
            ? shown(this.volume.volume_m3)
            : `${shown(this.volume.rear_m3)} + ${shown(this.volume.front_m3)}`;
        const typeName = BOX_TYPE_OPTIONS.find(o => o.value === this.boxType)?.label ?? this.boxType;
        return {type: typeName, volumes: `${amount} ${field.unitLabel(token)}`};
    }

    private lineWith(driverText: string, unitTokens: Readonly<Record<string, string>>): string {
        const details = this.boxDetails(unitTokens);
        return [driverText, details.type, details.volumes].join(' · ');
    }
}
