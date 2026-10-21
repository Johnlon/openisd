import {LimitState} from '../domain/project/tuneLimits.js';

/** Every word the Tune view shows. Short plain English; the UI prints these and adds none. */
export class TuneText {
    static readonly GUIDE: readonly string[] = [
        'The blue curve is how loud the box is at each pitch. The grey dashed curve is the saved design.',
        'Drag the green line sideways to tune the box lower or higher. Drag the box slider to make the box bigger or smaller.',
        'A value turns amber when it is within 10% of its limit, and red when it is over. A limit you leave blank is not checked.',
        'Keep stores what you see in the design. Revert to saved goes back.',
    ];
    static readonly GUIDE_TITLE = 'How to read this';

    static readonly PANEL_LIMITS = 'Limits';
    static readonly PANEL_RESPONSE = 'Response';
    static readonly PANEL_BOX_SIZE = 'Box size';
    static readonly PANEL_METERS = 'Meters';

    static readonly CHIP_F3 = 'F3';
    static readonly CHIP_VB = 'Box volume';
    static readonly CHIP_VENT_SPEED = 'Vent speed';
    static readonly CHIP_VENT_LENGTH = 'Vent length';
    static readonly CHIP_XMAX = 'Cone excursion';
    static readonly CHIP_VENT_DIAMETER = 'Vent diameter';

    static readonly TIP_F3 = 'The pitch where the box is 3 dB quieter than in its passband. It is a result of the design, not an input.';
    static readonly TIP_VB = 'The volume of air in the box.';
    static readonly TIP_VENT_SPEED = 'The fastest air in the vent over the sweep. Too fast and the vent chuffs.';
    static readonly TIP_VENT_LENGTH = 'The vent length that gives the tuning you set.';
    static readonly TIP_XMAX = 'The furthest the cone moves over the sweep, against the most the driver can move cleanly.';
    static readonly TIP_VENT_DIAMETER = 'A wider vent is quieter. The limit here is a minimum.';

    static readonly NOT_VENTED_NOTE = 'Tune needs a vented box.';
    static readonly SAVED_CAPTION = 'saved';

    static readonly STATE_OK = 'OK';
    static readonly STATE_NEAR = 'Near limit';
    static readonly STATE_OVER = 'Over limit';
    static readonly STATE_NONE = 'No limit';

    /** The words for a limit state. */
    static stateWord(state: LimitState): string {
        return LimitState.match(state, {
            none: () => TuneText.STATE_NONE,
            ok: () => TuneText.STATE_OK,
            amber: () => TuneText.STATE_NEAR,
            red: () => TuneText.STATE_OVER,
        });
    }
}
