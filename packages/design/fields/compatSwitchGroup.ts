/** A group heading in the WinISD Compatibility panel (John, 2026-10-05): the WinISD bugs and the
 *  options. */
export class CompatSwitchGroup {
    private constructor(readonly heading: string, readonly tooltip: string) {}

    static readonly BUGS = new CompatSwitchGroup(
        'Enable WinISD bugs',
        'Enable WinISD bugs: each switch brings back a known WinISD calculation bug. '
        + 'Unticked (default): OpenISD does the correct calculation. Ticked: OpenISD gives WinISD\'s result. '
        + 'A yellow frame marks each bug switch.');

    static readonly OPTIONS = new CompatSwitchGroup(
        'Enable WinISD-style …',
        'Enable WinISD-style …: each switch chooses between WinISD\'s way of doing a calculation (ticked, the default) '
        + 'and another valid way (unticked). Neither is a bug.');

}
