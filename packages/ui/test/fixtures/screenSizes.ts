/** The window sizes the layout specs cover (docs/spec/SPEC_UI.md UI-5; sizes proposed, QO471). CSS pixels of the window. */
export interface ScreenSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export type SizeSkin = 'desktop' | 'phone';

/** Must fit: everything on screen, no page scrollbar, nothing cut, no control off screen (phone: no sideways scroll). */
export const MUST_FIT_SIZES: Readonly<Record<SizeSkin, readonly ScreenSize[]>> = {
  // The stats record the screen, so the window is the screen less about 110 px of browser bars.
  desktop: [
    {name: '1920x1080 screen', width: 1920, height: 970},
    {name: '1536x864 screen (dpr 1.25)', width: 1536, height: 754},
    {name: '1440x900 screen (dpr 2)', width: 1440, height: 790},
    {name: '1366x768 screen', width: 1366, height: 657},
    {name: '2560x1440 screen', width: 2560, height: 1330},
  ],
  phone: [
    {name: 'phone 360x800', width: 360, height: 800},
    {name: 'phone 390x844', width: 390, height: 844},
    {name: 'phone 414x896', width: 414, height: 896},
    {name: 'phone 430x932', width: 430, height: 932},
  ],
};

/** May scroll, must not be mangled: nothing overlaps, nothing cut, every control reachable, no panel collapsed. */
export const MAY_SCROLL_SIZES: Readonly<Record<SizeSkin, readonly ScreenSize[]>> = {
  desktop: [
    {name: '1280x720', width: 1280, height: 720},
    {name: '800x600', width: 800, height: 600},
    {name: 'text zoom 200% (640x360 window)', width: 640, height: 360},
  ],
  phone: [
    {name: 'phone 320x640', width: 320, height: 640},
    {name: 'phone landscape 844x390', width: 844, height: 390},
  ],
};
