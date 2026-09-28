/**
 * The sealed-box loss model a project selects — a field's closed value set, so it lives with the
 * fields rather than with the physics that consumes it. `engine/lossMode.ts` holds the
 * resonance formulas and imports this; nothing here knows what a formula is.
 *
 * The registry names this set in `EnumField.LOSS_DAMPINGMODE`, and the engine reads the registry
 * for its own bands, so the enum cannot live on the engine side without making the two import
 * each other.
 */
import type {SelectorOption} from './options.js';

/** The wire value of a `LossMode` member — the only thing that crosses a boundary (storage,
 *  the `advanced.lossMode` schema slot, `SolverInput<string>`). Kept in its own named type so a
 *  consumer that needs the literal union (a schema `z.enum`, a domain field storing one) can name
 *  it without widening back to a bare `string`. */
export type LossModeValue = 'lossless' | 'conventional-lossy' | 'winisd-lossy';

/** The closed set of sealed-box loss models — a Java-style enum carrying its wire value + label. */
export class LossMode {
  private constructor(readonly value: LossModeValue, readonly label: string) {}

  static readonly Lossless = new LossMode('lossless', 'Lossless model');
  static readonly ConventionalLossy = new LossMode('conventional-lossy', 'Conventional lossy model');
  static readonly WinisdLossy = new LossMode('winisd-lossy', 'WinISD lossy model');

  /** Declaration order is the selector order. Keep WinisdLossy present — it is the default. */
  static readonly ALL: readonly LossMode[] = [
    LossMode.WinisdLossy,
    LossMode.Lossless,
    LossMode.ConventionalLossy,
  ];

  static readonly Default = LossMode.WinisdLossy;

  /** The members as picker options, in declaration order, so a selector cannot offer a value
   *  the engine does not accept. */
  static readonly OPTIONS: readonly SelectorOption<string>[] =
    Object.freeze(LossMode.ALL.map(m => Object.freeze({value: m.value, label: m.label})));

  /** Parse a wire value to a member, or the default when it is absent/unknown. */
  static parse(value: string | null | undefined): LossMode {
    return LossMode.ALL.find(m => m.value === value) ?? LossMode.Default;
  }

  toString(): string {
    return this.value;
  }
}
