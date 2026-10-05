/** A heading in the WinISD Compatibility panel (John, 2026-10-05): the WinISD bugs, the WinISD
 *  options, and the "Reset to WinISD" button that sets both. */
export class CompatSwitchGroup {
    private constructor(readonly heading: string, readonly tooltip: string) {}

    static readonly BUGS = new CompatSwitchGroup(
        'WinISD bugs',
        'WinISD bugs: each switch makes OpenISD reproduce a known WinISD calculation bug. '
        + 'Unticked (the default), OpenISD does the correct calculation. Ticked, WinISD\'s own result comes back. '
        + 'The yellow look marks them.');

    static readonly OPTIONS = new CompatSwitchGroup(
        'WinISD options',
        'WinISD options: each switch picks between WinISD\'s way of a calculation (ticked, the default) '
        + 'and another valid form (unticked). Neither is a bug.');

    static readonly RESET = new CompatSwitchGroup(
        'Reset to WinISD',
        'Reset to WinISD: ticks every WinISD option (WinISD\'s way) and unticks every WinISD bug (bug fixed). '
        + 'Never ticks a bug, never changes WinISD\'s own settings such as "Rg is at driver side", never changes project data.');
}
