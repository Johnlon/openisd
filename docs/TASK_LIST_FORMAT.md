# Task-list item format (MANDATORY)

Every line of a task list (`todowrite`) MUST be written in this shape, or it is not a task
line. There is no "mostly" — a line that does not fit is a line that is not understood.

## The one shape

    The <Subject> MUST <visible behaviour> when <condition>, except <exception>.

Read aloud: "The Save button MUST keep the current project's name when you switch tabs."
"The Graph MUST draw a second curve when the +Copy button is pressed."

## Parts

| Part | What it must be | Example |
|---|---|---|
| Subject | a human-recognisable object the user sees or touches — the Graph, the Save button, the project-row checkbox, the Driver Editor, the Options dialog, the Tune panel, the Project list | "The project-row checkbox" |
| visible behaviour | something a user OBSERVES happening (draw, hide, show, close, save, remember, ask, warn) — never an internal reaction | "MUST hide that project's curve on the Graph" |
| condition | what the user does, or what happens, that triggers it (when the +Copy button is pressed, when the checkbox is unticked, after the page reloads) | "when the checkbox is unticked" |
| exception (optional) | the one case it does NOT apply | "except for the currently selected project" |

## Banned in a task line

- Code identifiers, file paths, function/computed/hook/ref/property names — "the overlays
  computed", "visibleRevision", "the trace-building code", "buildPlotData", "generateSample.ts".
- Mechanism-speak that describes HOW something is done instead of WHAT the user sees —
  "recomputes", "re-subscribes", "re-derives", "invalidates the dependency".
- Restating a ledger id or a plan filename as the subject — "QO158", "the reorg plan".
- Anything a person who has never seen the codebase cannot parse.

A line like *"Verify the overlays computed re-runs when the show/hide checkbox is toggled
(visibleRevision dep landed)"* is FORBIDDEN: its subject is an internal object and its
behaviour is an internal reaction. It becomes *"The show/hide checkbox on a project's row
MUST remove that project's curve from the Graph when unticked."*

## Self-audit — do this before writing ANY list

1. Read every line as a person who has never seen the codebase.
2. If a line names an internal mechanism, needs code knowledge, or cannot be said out loud
   in plain English, REWRITE it.
3. If you cannot rewrite it because you don't know the subject or the visible behaviour, you
   do not understand the task — stop and work it out before writing the line.
4. Only then write the list.

## What "done" means

An item is ticked only when its visible behaviour is actually verified (a test passed, a
probe measured it), never on intent.