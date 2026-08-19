# BUG — the visible URL stops updating, so the address bar no longer reflects the design

# Status
OPEN 2026-08-14 — deliberately deferred to the OpenISDDriver migration

## Symptom

Reported by the human 2026-08-14: the address bar carries NO design state at all — it is entirely
empty of it, not merely stale. So there is nothing to copy: the URL cannot share the design on
screen, or any other.

This is the stronger of the two possible failures. A stale URL would mean the encoder runs and the
write happens with old input; an empty one means the design is never written to the address bar at
all — so the question to answer first is whether the write is happening and producing nothing, or
never happening.

## Status

RECORDED, NOT YET DIAGNOSED. Per the human's instruction this is deliberately deferred: it is to be
fixed once the OpenISDDriver migration completes, because the migration is rewriting the very state
the URL is derived from (`store.ts`'s driver layer → `ManagedDriver`), and a fix written against
the pre-migration state layer would be rewritten immediately.

No diagnosis is recorded here on purpose — an un-run guess is not a cause. When this is picked up,
the mechanism must be established before any change (§"NO WORKAROUNDS — DIAGNOSE, THEN FIX THE
CAUSE").

## Where to start when this is picked up

- The share-link encoder is `stateToUrl(...)` in `packages/ui/src/logic/persist.ts`, called from
  `shareLink()` in `packages/ui/src/logic/useDesignIO.ts`.
- What keeps the address bar in step with live state is a separate concern from generating a link
  on demand — establish which of the two is failing before touching either.
- The architectural rule this sits under is ARCHITECTURE.md §"Approved state stores": UI/display
  state, including keeping the publicly visible URL current, belongs to ONE approved location and
  nothing else may hold it.

## Verification, when fixed

A change to the design must be observable in the address bar without any further user action, and
the URL copied from the bar must restore exactly the design that was on screen.
