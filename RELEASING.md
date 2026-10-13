# Releasing

| Question | Answer |
|---|---|
| Who releases? | Fable, the SDLC agent, when John says so. |
| What is a stamp? | The build minute in UTC, `20260101T0102Z`. It names the zip, the tags and the folders. |
| Where is build output kept? | In GitHub Releases as zips. Never in git. |

## Snapshot builds

| Step | What happens |
|---|---|
| Trigger | A push to main, at most one build per two hours. Or `bash scripts/snap.sh` on demand (workflow_dispatch). |
| Build | `scripts/snap.sh` builds HEAD with relative paths and zips it as `openisd-<stamp>.zip`. |
| Publish | Tag `snap-<stamp>`, GitHub pre-release "Snapshot <stamp>", notes since the last release. |
| Notes | Plain sentences from each task file's `release_note:` (a sentence, or `internal`), plus resolved bugs. No ids, no hashes. Internal work is only counted. |
| Keep | The newest 10. Older pre-releases, tags and site folders are deleted. |
| Try one | Open `openisd.app/snap/`, tap a row. Or `openisd.app/snap/<stamp>/`. |

## Releases

| Action | Command | Result |
|---|---|---|
| Promote | `bash scripts/release.sh <stamp>` | Adds tag `v<stamp>` on the same commit. The pre-release becomes a release marked Latest. Branch `release` moves forward. A row is added to RELEASES.md. Nothing is built or downloaded. |
| Refused when | No `snap-<stamp>` tag, or an F in `tasks/fixes/` is open. | Nothing changes. |
| Own notes | `bash scripts/release.sh --notes-file F <stamp>` | F replaces the notes. Without it the snapshot's notes are kept. |
| Roll back | `bash scripts/release.sh --latest <stamp>` | The older release becomes Latest. The site root follows. |

## What users see

| Where | What |
|---|---|
| `openisd.app/` | The Latest release. Installing as an app is offered here only. |
| `openisd.app/v/` | Every release, newest first. Each stays hosted at `v/<stamp>/`. |
| `openisd.app/snap/` | Snapshot builds. The page warns they may upgrade saved data; a backup is taken first. |
| About in the app | The list of releases and snapshot builds, this one marked. |

## Tags

| Tag | Meaning |
|---|---|
| `snap-<stamp>` | A snapshot build. Stays after promotion. |
| `v<stamp>` | A release. The same commit as its `snap-` tag. |
| branch `release` | The latest promoted commit. Read-only; nothing lands on it. |

A task lands as one commit, subject "<id>: <goal>", body the release note; land.sh writes status done and landed.

The site is rebuilt from the GitHub Releases on every deploy. There is no gh-pages branch.
