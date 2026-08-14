# BUG_20260814 — `shareLink()` does not cancel an active what-if before serialising the driver

**Status:** FIXED in the same turn this file was written (Step 10, `ManagedDriver`). Proven by
`packages/ui/test/logic/useDesignIO.test.ts` — red (what-if still active after `shareLink()`)
before the one-line fix, green after.

## Symptom

`useDesignIO.ts`'s `shareLink()` builds the share URL from `driverJSON.value` without first
cancelling an active driver what-if. Every sibling I/O function in the same module
(`saveProject`, `saveProjectAs`, `exportWdr`, `exportWpr`, `exportOwdr`) calls
`endAnyActiveWhatIfBeforeIO()` first; `shareLink()` is the one that does not. `driverJSON` is
committed-only (never the what-if overlay) so the generated link itself does not carry the
overlay's scrubbed values — the user-visible defect is the silent inconsistency: a what-if is
left open and dirtying the screen after a share link was generated, while every other export
action in the same menu closes it. `ARCHITECTURE.md` §3 "A what-if never leaks into anything
persistent" names this exact function as the origin of the rule.

## The code

`packages/ui/src/logic/useDesignIO.ts:129-137`

    async function shareLink(): Promise<void> {
      const url = await stateToUrl(serialize(state, driverJSON.value));
      ...
    }

Compare `exportWdr` two lines later, `packages/ui/src/logic/useDesignIO.ts:139-143`:

    function exportWdr(): void {
      endAnyActiveWhatIfBeforeIO();
      ...
    }

## Fix

Add the missing `endAnyActiveWhatIfBeforeIO();` call at the top of `shareLink()`, matching
every sibling I/O function. `packages/ui/test/logic/useDesignIO.test.ts` gains a test: with a
what-if active, `shareLink()` cancels it (`isDriverWhatIfActive.value` false afterward) — proven
red first, then green.

This is a narrow, evidenced fix; `ManagedDriver` (this Step's main deliverable) closes the
*class* of bug structurally by making `readModified()` — the one path any future save/export
must use — cancel the what-if itself, so no future sibling function can forget the guard the
way this one did. `useDesignIO.ts` itself is not rewired onto `ManagedDriver` in this pass (see
the Step 10 report for why), so today's fix stays the scattered-guard shape until that rewire
happens.
