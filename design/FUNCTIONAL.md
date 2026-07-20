# FUNCTIONAL design — openisd (the app)

*What the app does*, independent of how it's built or presented. A **hub**. See
[`INDEX.md`](INDEX.md).

## What it does
An OpenISD speaker-box-modelling tool (a modern WinISD): load driver data, model
enclosures (sealed / vented / bandpass / passive-radiator), and compute + plot the
physics (SPL, transfer function, impedance, cone excursion, port velocity, group delay),
with filters/signal-chain and shareable state.

## Authoritative sources
- **`../FEATURE_COMPARISON.md`** — the consolidated feature/tool-comparison reference
  (merged 2026-07-20 from FEATURES.md + WINISD_OPENISD_COMPARISON.md + OTHER_TOOLS.md +
  SPEAKER_TOOL_LANDSCAPE.md — one section per former doc): capabilities, WinISD parity,
  web-alternatives matrices, external-tool research, landscape survey.
- **`../BACKLOG.md`** — prioritised functional backlog (what's built / next; also carries
  the ad-hoc notes merged from WIP.md, 2026-07-20).
- **`../REFERENCES.md`** — the physics theory canon + test oracles the calculations honour.
