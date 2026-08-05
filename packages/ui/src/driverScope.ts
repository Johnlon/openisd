// Which POOL of drivers the picker lists — a closed set, so an enum in this repo's
// Java-style shape (AGENTS.md "Closed sets are enums"), carrying its wire value, its
// segment label, its prose description and its two membership answers ON the member.
//
// The picker renders every member at once as one segmented control and rotates the
// highlight on click, so `ALL` is both the render order and the cycle order.
//
// Orthogonal to the Favorites filter: scope decides WHICH DRIVERS ARE CANDIDATES, the star
// decides which of those are shown. The two compose, so all six pairings are reachable.
//
// `.value` is the serialised form and the ONLY thing that crosses a boundary — in
// particular the Vue reactive store, whose proxy would break `===` identity on a member
// held in a `ref`. Same members-inside / value-at-the-boundary split as `DriverType`.

export class DriverScope {
  private constructor(
    /** The serialised form — what a `ref` holds, and the one thing `parse` accepts. */
    readonly value: string,
    /** This scope's segment in the control. All three are on screen at once, so the label
     *  names a CHOICE the user can see, not just the state they are in. */
    readonly label: string,
    /** What the label actually means — the part the control cannot show. Tooltip prose. */
    readonly description: string,
    /**
     * Whether the app's own driver database is a candidate. That pool is `allFiles` in
     * useDriverLibrary — everything the build ships; a federated source added from another
     * picker joins the same pool and is scoped with it.
     */
    readonly includesBundled: boolean,
    /** Whether the user's saved drivers ("My Drivers", browser storage) are candidates. */
    readonly includesMine: boolean,
  ) {}

  // Declaration order IS the click cycle — `next` walks `ALL`, so adding a member here is
  // the only step needed to put it in the rotation.
  static readonly Bundled = new DriverScope('bundled', 'Bundled',    'the drivers shipped with the app', true,  false);
  static readonly Mine    = new DriverScope('mine',    'My Drivers', 'your own saved drivers',           false, true);
  static readonly All     = new DriverScope('all',     'All',        'every driver, bundled and saved',  true,  true);

  /** Every scope, in click order. Must stay LAST — static fields initialise in source order. */
  static readonly ALL: readonly DriverScope[] =
    Object.values(DriverScope).filter((v): v is DriverScope => v instanceof DriverScope);

  /**
   * The ONE string -> member boundary. A value the enum does not declare is invalid, not a
   * second spelling to tolerate; the caller decides how loudly to say so.
   */
  static parse(raw: string | null | undefined): DriverScope | null {
    const token = (raw ?? '').trim().toLowerCase();
    return token ? (DriverScope.ALL.find(s => s.value === token) ?? null) : null;
  }

  /** The scope one click away. Wraps, so the chip cycles forever. */
  get next(): DriverScope {
    const i = DriverScope.ALL.indexOf(this);
    return DriverScope.ALL[(i + 1) % DriverScope.ALL.length];
  }

  /**
   * The control's tooltip. It says what the ACTIVE label means — the one thing three
   * visible labels cannot tell you — and stops there: naming the next scope would repeat
   * the segment sitting right beside it, and the fixed order already shows where the
   * highlight goes next.
   */
  get title(): string {
    return `Showing ${this.description} — click to rotate`;
  }

  toString(): string { return this.value; }
  toJSON(): string { return this.value; }
}
