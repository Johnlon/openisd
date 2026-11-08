# BUG_20261108_phone-driver-name-button-overflows

**Status:** RESOLVED

## Symptom
Phone Driver tab: with a long driver name ("SB Acoustics SB15BAC30-8-COAX/ aluminum") the driver-name button is cut: its text is 587 px wide in a 340 px button.

## Evidence
AI live review, ui-gallery/live-review/20261108T091258Z/ (scrollWidth 587 > 340). Reproduced at 374x705: scrollWidth 653 > clientWidth.

## Cause
`.mob-classic .mob-cname` (style.css) is one line, nowrap, overflow hidden; the button shares it.

## Fix
`.mob-cname-button` wraps (auto height, overflow-wrap anywhere) and carries the full name as its title.

## Verification
mobile-long-driver-name-fits.browser.spec.ts; mobile-driver-tab.browser.spec.ts.
