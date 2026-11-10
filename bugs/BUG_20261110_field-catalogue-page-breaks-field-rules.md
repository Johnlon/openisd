# Field catalogue page: sideways scroll on the phone, and its value boxes differ in width and height by design

Status: OPEN. Found by T782 (`view-layout-walk.browser.spec.ts`, view `shared/field-catalogue`) on 10 Nov 2026, phone 374 x 705 and desktop 1440 x 900.

Open the app with `?field-catalogue` in the address. The page lists a sample of every field style.

- Phone: the page scrolls sideways by 34 px (rules R2 and W2). We need it to fit the window.
- Both skins: the value boxes are not one width or one height (rules R4 and R5: 119 px against 258 px wide, 26 px against 34 px high on the phone), because the page shows each style on purpose. We need John's word on whether a catalogue of styles is exempt from R4 and R5; until then the walk lists them as known faults.

The walk lists these as known faults and each turns red when it is fixed; then delete the entry in KNOWN.
