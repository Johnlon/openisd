/** A group heading in the WinISD Compatibility panel (John, 2026-10-05): the WinISD bugs and the
 *  options. */
export class CompatSwitchGroup {
    private constructor(readonly heading: string, readonly tooltip: string) {}

    static readonly BUGS = new CompatSwitchGroup(
        'WinISD bugs',
        'WinISD bugs: each switch makes OpenISD reproduce a known WinISD calculation bug. '
        + 'Unticked (the default), OpenISD does the correct calculation. Ticked, WinISD\'s own result comes back. '
        + 'The yellow look marks them.');

    static readonly OPTIONS = new CompatSwitchGroup(
        'Options',
        'Options: each switch picks between WinISD\'s way of a calculation (ticked, the default) '
        + 'and another valid form (unticked). Neither is a bug.');

}
