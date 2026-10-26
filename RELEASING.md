# Releasing

| Question | Answer |
|---|---|
| Who releases? | Only after John explicitly approves the production release. |
| What is a stamp? | The build minute in UTC, `20260101T0102Z`. It names the zip, the tags and the folders. |
| Where is build output kept? | In GitHub Releases as zips. Never in git. |

## Snapshot builds

| Step | What happens |
|---|---|
| Trigger | Every push to main, at once. Or `bash scripts/snap.sh` on demand (workflow_dispatch). |
| Build | `scripts/snap.sh` builds HEAD with relative paths and zips it as `openisd-<stamp>.zip`. |
| Publish | Tag `snap-<stamp>`, GitHub pre-release "Snapshot <stamp>", notes since the last release. |
| Notes | Plain sentences from each task file's `release_note:` (a sentence, or `internal`), plus resolved bugs. No ids, no hashes. Internal work is only counted. |
| Keep | The newest 10. Older pre-releases, tags and site folders are deleted. |
| Try one | `test.openisd.app` is the newest. Or open `snapshots.openisd.app/snap/`, tap a row, or `snapshots.openisd.app/snap/<stamp>/`. |

## Releases

| Action | Command | Result |
|---|---|---|
| Prepare, then wait for approval | `bash scripts/release.sh --prepare --public <n.n.n> [--notes-file F] <stamp>` | Checks the snapshot is the current main build and test site, verifies production matches GitHub Latest, confirms no fix is open, runs the hosted-copies browser test and the UI gallery, then writes `build/release-preflight/<stamp>-<public>.json`. It does not publish. The record expires after seven days and is bound to the snapshot, main, Latest, test, production, release branch and notes-file hash. The command prints the next approval command. |
| Approve and publish | `bash scripts/release.sh --approve-prepared <manifest>` | Rechecks that every recorded value is still current, then promotes without rerunning the browser checks. Changed notes, newer main, a different test or production build, a changed Latest release or a moved `release` branch make it refuse; prepare again after that. Promotion assigns `v<stamp>` to the prepared commit, marks the release Latest, moves `release` forward, adds a row to RELEASES.md and dispatches production deployment. |
| One-command promote | `bash scripts/release.sh --public <n.n.n> [--notes-file F] <stamp>` | Runs the hosted-copies browser test and UI gallery, then promotes in one command. Use this when preparation and approval are happening together. |
| Refused when | The snapshot or hosted build IDs do not match, an F in `tasks/fixes/` is open, the public number is not newer, or a prepared record is stale. | Nothing is published. |
| Own notes | Add `--notes-file F` to `--prepare` or `--public`. | F replaces the notes. A prepared release also checks the file has not changed before approval. Without it the snapshot's notes are kept. |
| Roll back | `bash scripts/release.sh --latest <stamp>` | The older release becomes Latest. The site root follows. |

The production approval point is the `--approve-prepared` command: preparation performs the slow checks and leaves a reviewable record, while approval only revalidates the record and publishes. Do not run that command until John says to go live.

## What users see

| Where | What |
|---|---|
| `openisd.app/` | The Latest release, and nothing else. Installing as an app is offered here only. The old addresses `/test/`, `/v/…` and `/snap/…` send you to the new sites. |
| `test.openisd.app` | The newest snapshot build. |
| `snapshots.openisd.app/v/` | Every release, newest first. Each stays hosted at `v/<stamp>/`. |
| `snapshots.openisd.app/snap/` | Snapshot builds. The page warns they may upgrade saved data; a backup is taken first. |
| Storage | Each of the three sites is its own origin: a test or snapshot build never sees production's projects or service worker. |
| About in the app | The list of releases and snapshot builds, this one marked. |

## Tags

| Tag | Meaning |
|---|---|
| `snap-<stamp>` | A snapshot build. Stays after promotion. |
| `v<stamp>` | A release. The same commit as its `snap-` tag. |
| branch `release` | The latest promoted commit. Read-only; nothing lands on it. |

A task lands as one commit, subject "<id>: <goal>", body the release note; land.sh writes status done and landed.

The site is rebuilt from the GitHub Releases on every deploy. There is no gh-pages branch.

## Hotfix history on `release`

A hotfix cut on `release` lives only there until main gets the same fix as its own commit. When the next main snapshot is promoted, `release.sh` cannot fast-forward, so it pushes a merge commit instead: its tree is exactly the promoted build, its parents are the old `release` tip and the snapshot, so the hotfix commit stays in history. This is worked out and dry-run checked before the release is published. The tag `v<stamp>` stays on the snapshot commit, not the merge.
