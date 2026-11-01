# iOS: "Script error." ×5 on the passive-radiator box tab, release 7.0.957

Found: 1 Nov 2026, telemetry Crashes table (crash hash 12bddd7564decce099945c75). Cause not yet known; T639 (1 Nov 2026) makes the next report name it: a masked window error carries its file:line, and a sweep-worker failure is reported with its own message and place instead of reaching the window masked.

## What happened

One iOS user on the mobile skin, with 1 project open, box type passive radiator, action `tab:box`,
sent 5 crash reports at 02:56 UTC on 1 Nov, all on the current release v20261031T1739Z (7.0.957).
The message is "Script error." with no frames.

## What "Script error." means

Safari (and every browser) replaces the message and stack of an error thrown by a script loaded
from another origin, or by a script tag without `crossorigin`, with "Script error." So the
report says only where the user was, not what broke.

## Two things to do

1. Make iOS report the real error: the app's script tags (or the service worker's cached copies)
   must be same-origin with `crossorigin=anonymous` and served with `Access-Control-Allow-Origin`,
   and the error handler should send `error.stack` from `window.onerror`'s fifth argument and from
   `unhandledrejection`, not only the message.
2. Reproduce: mobile skin, a passive-radiator project, open the Box tab, on an iOS WebKit viewport
   (Playwright WebKit, 374x705). The 25 Oct release had 4 of the same on 29 Oct, so it is not new
   to 7.0.957.

## Evidence

Telemetry dashboard, Crashes section, row dated 2026-11-01 02:56, count 5, context
`screen: mobile/box, dialog: none, projects: 1, box: box-passive-radiator, device: ios, actions: tab:box`.
