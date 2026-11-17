/**
 * What reloading the page really loses (T829; John, 2026-11-15: "pulling a new version says you lose
 * unsaved but that's not true").
 *
 * Every edit to an open project is written to the stored open-project session as it is made, saved and
 * edited layers together, so a reload brings an unsaved edit back, still unsaved. What a reload does lose:
 * edits the store did not take, everything done on a read-only backup, values typed in an open driver
 * editor and not applied, and values tried in a What-if. This says which of those hold.
 */
import type {ReloadLoss} from '@openisd/design/fields';

/** What the app knows when it decides whether a reload is safe. */
export interface ReloadFacts {
  /** Some open project has edits that are not saved. */
  readonly anyUnsaved: boolean;
  /** The stored session holds the open projects exactly as they are now. */
  readonly sessionStored: boolean;
  /** The app runs on a backup held in memory: nothing it does is stored. */
  readonly readOnlyStore: boolean;
  /** An open driver editor holds values not applied. */
  readonly editorDraftChanged: boolean;
  /** An open What-if holds values that differ from the design. */
  readonly whatIfChanged: boolean;
}

export function reloadLosses(facts: ReloadFacts): ReloadLoss[] {
  const losses: ReloadLoss[] = [];
  if (facts.anyUnsaved) {
    if (facts.readOnlyStore) losses.push('readOnlyStore');
    else if (!facts.sessionStored) losses.push('unstoredEdits');
  }
  if (facts.editorDraftChanged) losses.push('editorDraft');
  if (facts.whatIfChanged) losses.push('whatIf');
  return losses;
}
