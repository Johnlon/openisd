---
paths:
  - "packages/engine/src/**/*"
---

# openisd — engine source constants and citations

- **No magic numbers, in exactly one of two forms** (human ruling, 2026-08-13). Every non-obvious
  numeric constant in `packages/engine/src/` is written as:
  1. **A named symbol**, with its value and meaning given beside its declaration — e.g.
     `const V_2_83 = 2.83; // reference test voltage: sqrt(1 W * 8 ohm), IEC 60268-5`, used as
     `V_2_83 ** 2` at the call site; or
  2. **The literal inline, with a comment at the call site** explaining what it is — e.g.
     `10 * Math.log10(2.83 ** 2 / Re) // 2.83 V is the reference test voltage`.
  A bare literal with no explanation, in either place, is not acceptable — a reader must never
  have to ask "why this number" without the answer sitting next to it. A source reference is
  added where one exists; where the WHAT is proven (by a WinISD probe, say) but the WHY is not
  yet known, say so explicitly rather than omitting the comment or inventing a plausible reason.
- **Citations must be verified.** Any reference in a source comment — AES paper, Wikipedia URL,
  textbook — is checked to exist before it is written. Never invent or assume a URL. Mark one
  that could not be checked with `⚠ Unverified reference`.

The unit-test contract these formulas must satisfy is in
`_agent_files/rules/openisd-engine-tests.md`; the permission gate over calculation logic, physical
constants, display precision and result-affecting defaults is in `openisd/AGENTS.md`
§"Calculation logic — permission gate".
