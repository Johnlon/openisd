@CLAUDE.md
@../_agent_files/_AGENTS.md

## Duplicate-logic check on every pull request

`scripts/dupscan.mjs` runs in the `architecture` job of `.github/workflows/pr.yml` (pull request and merge queue). It finds copies of code with jscpd (pinned devDependency) and lines that match the formula rules (driver-count scaling, resonance, dB, air, unit factors, maths in `packages/ui`), and exits 1 on any finding not listed in `scripts/dupscan-allow.json`. A new copy of a formula therefore fails the pull request until the copy is removed (call the engine instead) or John allows it. Findings that existed on 18 Nov 2026 are the baseline, each with reason "baseline 2026-11-18 (QO946.c256)" (John, 18 Nov 2026, "yes" to making the scan a check on every pull request). Test: `bash scripts/test/dupscan.test.sh`.

`scripts/dupscan-allow.json` is a gate file: a key added to it needs a `reason` that quotes a John ruling. Agents never add keys on their own and never regenerate it with `--write-baseline` (standing rule "No agent weakens anything on its own"). Removing a key, when its copy is gone, is welcome.
