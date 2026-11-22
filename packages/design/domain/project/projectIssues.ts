import type { AirIssue, DqIssue, DriverIssue, PrIssue, PrSpecIssue, SealedAlignmentIssue, SignalIssue, VentIssue } from '../../engine/index.js';

/** `OpenISDProject#resolve()`'s cached result — the current layer's own issues, by channel.
 *  `driver` is this step (S2-7d1); vent/PR/sealed/environment join it in S2-7d2. */
export interface ProjectIssues {
    readonly driver: readonly DriverIssue[];
    readonly signal: readonly SignalIssue[];
    /** The vented box's vent; bandpass4's, bandpass6's and ABC's front vent. */
    readonly vent: readonly VentIssue[];
    /** bandpass6's and ABC's rear vent. */
    readonly rearVent: readonly VentIssue[];
    readonly pr: readonly PrIssue[];
    /** The radiator's stated figures that contradict each other, each issue naming every figure in
     *  its relation. */
    readonly radiator: readonly PrSpecIssue[];
    readonly sealed: readonly SealedAlignmentIssue[];
    /** The designed tuning's own plausibility mark — WinISD's answer is not changed, only
     *  judged. Appended to `vent`'s own mark on `tuning_goal_hz`, never over it: the two say
     *  different things (this geometry does not solve / nobody would build this). */
    readonly ventTuningExtra: DqIssue | null;
    /** The air solver's issues: a conflict between the five air quantities, a quantity it could
     *  not give, an entered temperature outside the air model. Each names the fields it concerns. */
    readonly air: readonly AirIssue[];
}
