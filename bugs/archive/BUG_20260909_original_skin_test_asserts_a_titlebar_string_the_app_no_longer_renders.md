# The Original-skin test asserts a titlebar string the app no longer renders

Status: CLOSED (re-verified 2026-09-26) — confirmed: the titlebar string is retired; the shell has one identity.

## Symptom

With the startup setup repaired (see
`BUG_20260909_a_first_visit_opens_with_no_project_so_thirty_browser_tests_time_out.md`), the
first Original-skin test reaches its assertion and fails:

```
Error: expect(locator).toContainText(expected) failed
Locator: locator('.original-root')
Expected substring: "WinISD Original Mode"
Received string:    "▾Open...▾About OpenISDSPL▾Transfer function magnitude…"
```

The shell renders correctly — projects list, Signal Generator, graph, all seven tabs are in the
captured text. Only the expected phrase is absent.

## Example

The string exists in exactly one place in the repo, and it is the test:

```
$ command grep -rn "WinISD Original Mode" packages/ui/src/ packages/ui/test/
packages/ui/test/ui/original-skin.browser.spec.ts:73
```

```ts
await expect(page.locator('.original-root')).toContainText('WinISD Original Mode');
```

The rendered titlebar carries `About OpenISD` in its place.

## Impact

One test asserts branding the app deliberately no longer uses. It is the only thing standing
between this spec and green now that the startup path is fixed, and it asserts nothing about
behaviour — the three assertions beside it (Projects, Signal Generator, the graph panel) are
the ones that prove the shell mounted.

The risk of leaving it is that it reads as a real shell regression when it is a stale string.

## Cause

The product was renamed from "WinISD Original Mode" to "OpenISD"; the titlebar followed and
this assertion did not. Nothing in `packages/ui/src` has rendered the old phrase since.

NOT established: exactly which commit renamed it. The rename itself is evident from the live
DOM and from `About OpenISD` being what the titlebar now shows.

## Fix

Assert what the titlebar actually identifies the app as, rather than the retired phrase. The
neighbouring assertions on the same locator (`Projects`, `Signal Generator`, `.graph-wrap
.gpanel`) already carry the "the Original shell mounted" claim, so the replacement asserts
identity, not layout.

This is a stale expected VALUE, not a loosened assertion: the test still fails if the shell
does not render.

## Verification

Pending — to be run as part of the repaired Original-skin spec.
