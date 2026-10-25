# BUG_20261020_gate-hook-runs-on-every-tool-call

**Status:** FIXED (T494)

Recorded 20 Oct 2026 by bob, from the workspace-tools load audit row 7.

## Symptom
Every tool call of every session in openisd (Read and Grep too) starts the gate checker: about 0.7 s and 4-5 processes per call, measured at load 25. With 15 sessions this is hundreds of gate processes at peak.

## Cause
The PreToolUse hook in `.claude/settings.json` has matcher `*`. The gates only check Bash, Monitor and the edit tools (Edit, Write, MultiEdit, NotebookEdit).

## Fix
Matcher `Bash|Monitor|Edit|Write|MultiEdit|NotebookEdit`. John agreed on QO287. Test: packages/design/test/architecture-gate-hook-matcher.test.ts.
