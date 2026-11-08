/**
 * The fonts the app carries and which skin draws in which (John, QO466): the desktop skin keeps the look
 * Windows users see today (Selawik, Microsoft's open font with Segoe UI's letter widths), the phone skin
 * the look Android shows today (Roboto), and fixed-width text a bundled mono face. The app names no other
 * font anywhere, not even as a fallback: the UI reads them as the CSS variables `cssVars()` names, and the
 * font scan and browser tests allow exactly `all()`.
 */
export class AppFont {
  static readonly SELAWIK = new AppFont('Selawik');
  static readonly ROBOTO = new AppFont('Roboto');
  static readonly MONO = new AppFont('JetBrains Mono');

  private constructor(
    /** The family name the @font-face rule gives the bundled files. */
    readonly family: string,
  ) {}

  /** The family as a computed-style or font-family value. */
  cssValue(): string { return this.family.includes(' ') ? `"${this.family}"` : this.family; }
}

export class SkinFonts {
  static readonly DESKTOP = AppFont.SELAWIK;
  static readonly PHONE = AppFont.ROBOTO;
  static readonly MONO = AppFont.MONO;

  /** Every bundled family, and so every family the app may name. */
  static all(): readonly AppFont[] { return [SkinFonts.DESKTOP, SkinFonts.PHONE, SkinFonts.MONO]; }

  /** The fonts as CSS custom properties. */
  static cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--font-desktop', SkinFonts.DESKTOP.cssValue()],
      ['--font-phone', SkinFonts.PHONE.cssValue()],
      ['--font-mono', SkinFonts.MONO.cssValue()],
    ]);
  }
}
