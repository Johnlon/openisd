/**
 * How one scanned source branch relates to the view index (T739 step 3).
 * view: the branch is that view (a dialog root, a tab pane). partOf: content inside that view.
 * notAView: not a view of its own (a disabled state, a loading spinner, a trigger button, a layout wrapper).
 * View ids are checked against VIEW_INDEX by branch-map.test.ts; the index ids are computed strings, so the compiler cannot narrow them.
 */
export type Mapping =
  | {readonly kind:'view'; readonly view:string}
  | {readonly kind:'partOf'; readonly view:string}
  | {readonly kind:'notAView'; readonly reason:string};
/** Scanned record id (discoverMobileSources) to its mapping. */
export type BranchMap=Readonly<Record<string,Mapping>>;
