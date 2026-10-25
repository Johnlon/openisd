/** The phone screens the layout specs cover (about 95% of phones), smallest height to largest. */
export interface PhoneSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

/** John's phone: the Chrome page area he measured on his Pixel 9 (18 Oct 2026), not the screen. */
export const PIXEL_9: PhoneSize = {name: 'Pixel 9', width: 374, height: 705};

export const PHONE_SIZES: readonly PhoneSize[] = [
  {name: 'iPhone SE', width: 375, height: 667},
  PIXEL_9,
  {name: 'small Android', width: 360, height: 740},
  {name: 'iPhone 12-15', width: 390, height: 844},
  {name: 'Pixel 7', width: 412, height: 915},
  {name: 'iPhone Pro Max', width: 430, height: 932},
];
