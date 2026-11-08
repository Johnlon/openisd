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
  /** The symbols, arrows, Greek letters and subscripts the three text faces lack: small subsets of Noto Sans and Roboto, one family. */
  static readonly SYMBOLS = new AppFont('AppSymbols');

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
  static readonly SYMBOLS = AppFont.SYMBOLS;

  /** Every bundled family, and so every family the app may name. */
  static all(): readonly AppFont[] { return [SkinFonts.DESKTOP, SkinFonts.PHONE, SkinFonts.MONO, SkinFonts.SYMBOLS]; }

  /** A skin's font as the font-family value the UI uses: the text face, then the symbols face for glyphs it lacks. No system font. */
  static stack(text: AppFont): string { return `${text.cssValue()}, ${SkinFonts.SYMBOLS.cssValue()}`; }

  /** The fonts as CSS custom properties. */
  static cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--font-desktop', SkinFonts.stack(SkinFonts.DESKTOP)],
      ['--font-phone', SkinFonts.stack(SkinFonts.PHONE)],
      ['--font-mono', SkinFonts.stack(SkinFonts.MONO)],
    ]);
  }
}
