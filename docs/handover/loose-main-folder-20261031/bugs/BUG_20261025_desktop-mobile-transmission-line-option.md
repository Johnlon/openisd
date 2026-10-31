# BUG_20261025_desktop-mobile-transmission-line-option

**Status:** DEFERRED (F56; nonblocking for release 7.0.953 per John, 25 Oct 2026)

## Report

John, 25 Oct 2026: the Advanced tab's “Use transmission line-model for port simulation” option appears greyed out on desktop, while he believes it is enabled on mobile.

## Expected

The option has the same enabled state on desktop and mobile for the same project. It is available for box types with a vent port and unavailable for box types without one.

## Investigation

Desktop and mobile both render `AdvancedOptions.vue`, which disables the checkbox when the selected box has no vent port. The reported desktop/mobile difference has not yet been reproduced, so F56 must verify it against the same vented project and correct the cause if confirmed.
