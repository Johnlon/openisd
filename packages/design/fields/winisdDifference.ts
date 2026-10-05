import {WinisdDeviation, WinisdFilterDeviation} from './winisdDeviation.js';
import {WinisdFixedBug} from './winisdFixedBug.js';
import {WinisdOption} from './winisdOption.js';

/** A WinISD calculation bug whose yellow switch under "Enable WinISD bugs" brings it back. */
export interface BugSwitchSource {
  readonly kind: 'bugSwitch';
  readonly deviation: WinisdDeviation;
}

/** A switch under "Enable WinISD-style". */
export interface OptionSource {
  readonly kind: 'option';
  readonly option: WinisdOption;
}

/** An input WinISD ignores; OpenISD honours it, with a ≠W cue and no switch. */
export interface IgnoredInputSource {
  readonly kind: 'ignoredInput';
  readonly deviation: WinisdDeviation;
}

/** A WinISD update, linkage, crash or data-loss bug; OpenISD fixes it with no switch. */
export interface FixedBugSource {
  readonly kind: 'fixedBug';
  readonly bug: WinisdFixedBug;
}

export type WinisdDifferenceSource = BugSwitchSource | OptionSource | IgnoredInputSource | FixedBugSource;

/** What an entry says, read from its source. */
interface EntryText {
  readonly title: string;
  readonly winisd: string;
  readonly openisd: string;
  readonly seenIn: string;
  readonly size: string;
  readonly control: string | null;
}

function textOf(source: WinisdDifferenceSource): EntryText {
  switch (source.kind) {
    case 'bugSwitch':
    case 'ignoredInput': {
      const d = source.deviation;
      return {title: d.title, winisd: d.winisd, openisd: d.openisd, seenIn: d.seenIn, size: d.size,
        control: d.control === null ? null : d.control.label};
    }
    case 'option': {
      const o = source.option;
      return {title: o.title, winisd: o.winisd, openisd: o.openisd, seenIn: o.seenIn, size: o.size, control: o.switchField.label};
    }
    case 'fixedBug': {
      const b = source.bug;
      return {title: b.title, winisd: b.winisd, openisd: b.openisd, seenIn: b.seenIn, size: b.size, control: null};
    }
  }
}

function deviationSource(deviation: WinisdDeviation): WinisdDifferenceSource {
  return deviation.control === null ? {kind: 'ignoredInput', deviation} : {kind: 'bugSwitch', deviation};
}

function anchorOf(title: string): string {
  return `winisd-diff-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** One entry on the "OpenISD and WinISD differences" help page. */
export class WinisdDifference {
  readonly kind: WinisdDifferenceSource['kind'];
  readonly title: string;
  /** What WinISD does. */
  readonly winisd: string;
  /** What OpenISD does. */
  readonly openisd: string;
  /** The charts and readouts it shows in. */
  readonly seenIn: string;
  /** How large the effect is. */
  readonly size: string;
  /** The title of the switch that picks WinISD's behaviour; null where there is none. */
  readonly control: string | null;
  /** The entry's place on the page. */
  readonly anchor: string;
  readonly #source: WinisdDifferenceSource;

  private constructor(source: WinisdDifferenceSource) {
    const t = textOf(source);
    this.kind = source.kind;
    this.title = t.title;
    this.winisd = t.winisd;
    this.openisd = t.openisd;
    this.seenIn = t.seenIn;
    this.size = t.size;
    this.control = t.control;
    this.anchor = anchorOf(t.title);
    this.#source = source;
  }

  /** This entry explains `d`'s ≠W cue. */
  explains(d: WinisdDeviation): boolean {
    switch (this.#source.kind) {
      case 'bugSwitch':
      case 'ignoredInput': return this.#source.deviation === d;
      case 'option':
      case 'fixedBug': return false;
    }
  }

  /** Every entry: the ≠W cues' (bug switches and ignored inputs), the options, the fixed bugs. */
  static readonly ALL: readonly WinisdDifference[] = Object.freeze([
    ...[...WinisdDeviation.ALL, ...WinisdFilterDeviation.ALL].map(d => new WinisdDifference(deviationSource(d))),
    ...WinisdOption.ALL.map(option => new WinisdDifference({kind: 'option', option})),
    ...WinisdFixedBug.ALL.map(bug => new WinisdDifference({kind: 'fixedBug', bug})),
  ]);

  /** The entry a ≠W cue's "More…" opens. */
  static forDeviation(d: WinisdDeviation): WinisdDifference {
    const hit = WinisdDifference.ALL.find(e => e.explains(d));
    if (hit === undefined) throw new Error(`WinisdDifference: no entry for the deviation "${d.title}"`);
    return hit;
  }
}
