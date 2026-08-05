# BUG_20260805 — `CONTRACT.md` declares `parseWdr` throws, contradicting the live `Result` contract

**Status:** OPEN — not fixed. `parseWdr` no longer exists under that name, so the correct
replacement text depends on a decision about what the row should describe.

## Symptom

`CONTRACT.md` is the repo's "Design → Curves Contract (v1)" — the most authoritative-looking
statement of the engine's interface. Its File I/O table declares that the WinISD parser
**throws**. The engine's actual contract is the opposite: nothing throws, and failure travels
through `Result` as `{ value, errors }`.

An agent or developer reading `CONTRACT.md` to learn the interface will write throwing code,
or will write a caller that wraps the parse in `try`/`catch` and never inspects `errors`.

## The code

`/home/john/work/winisd/openisd/CONTRACT.md:200`

    | `parseWdr(text)` | `string → RawDriver` | Parse a WinISD `.wdr` file; throws on missing core params |

The live contract, `/home/john/work/winisd/openisd/CODE_REVIEW/ENGINE_HARDENING.md:39-51`:

> The engine's error contract is Go-style: the parse/derive entry points return
> `Result<T> = { value: T | null, errors: DriverError[] }` with levelled errors (`error`
> blocks; `warn` drops one reference line).
>
> **No engine function throws.**

`parseWdr` itself no longer exists. A grep across `packages/` finds it only in comments and in
a UI-local `parseWdrLoose`; it was replaced by `Driver.fromWdr`, which validates through the
same `#derive()` and returns a `Result`.

So the row is wrong twice: it names a function that is gone, and it describes an error
convention the codebase abandoned.

## Root cause

`CONTRACT.md` was never reconciled against the document holding the `Result` rules
(`.claude/rules/openisd-result-contract.md`), and nothing gates a documented signature against
the code, so the contradiction was invisible.

## Why it was not fixed on the spot

The row cannot simply be corrected in place: the function it names is gone. Fixing it means
deciding whether the File I/O table should describe `Driver.fromWdr` and `toWdr`, or whether
`CONTRACT.md` should stop describing file I/O at all now that the `Driver` ADT owns it. That
is a documentation-ownership call, not a typo.

`CONTRACT.md` is also outside the scope of the task that found this, and openisd's working
tree currently has several agents and another session editing it.

## The authority to reconcile against

`.claude/rules/openisd-result-contract.md` states the operative rules — return a degraded
`value` rather than `null` where data is partially usable; the caller always checks `errors`
and annotates a deliberate discard; every third-party thrower is wrapped; per-point `null` plus
a `warn` for partial failure; pure math in `packages/engine/src/` stays plain-return — and the
`{ level, field, message }` breakdown. `ENGINE_HARDENING.md` carries only the *shape* of the
contract, so it is not the document to reconcile `CONTRACT.md` against.

## **Evidence (artifact checked this session):**

`sed -n '196,204p' CONTRACT.md` run 2026-08-05 against the working tree, output quoted above
verbatim, showing the `throws on missing core params` cell at line 200.

The `ENGINE_HARDENING.md:39-51` quotation and the `grep` result establishing that `parseWdr`
no longer exists were produced by two separate agents in this session, each of which read the
files directly. Those specific line numbers were not re-read here — the tree is being edited
concurrently, so treat them as needing a re-check before editing.
