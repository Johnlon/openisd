# Claude reviews every pull request

John, 15 Nov 2026: reviews run by the gates themselves, not by whoever remembers to ask (T818, QO923). Claude, on GitHub's
runners, reviews every pull request from a branch of this repository, and looks at every baseline picture a pull request
adds or changes. It is **advisory**: a red check and comments, never part of `pr-gate`.

| Thing | Where |
|---|---|
| Code review | `.github/workflows/claude-review.yml`, skill `.claude/skills/review-pull-request/SKILL.md` |
| Picture review | `.github/workflows/claude-review-pictures.yml`, skill `.claude/skills/review-baseline-pictures/SKILL.md`, mechanical pass and contact sheets `scripts/visual/review-pictures-prep.py` |
| Skip rule, verdict to colour | `scripts/ci/claude-review-needed.sh`, `scripts/ci/claude-review-verdict.sh` |
| What is proved before merge | `scripts/land/test/claude-review-workflows.test.sh` |
| Credential | repository secret `CLAUDE_CODE_OAUTH_TOKEN` (a subscription token John set; no agent reads, prints or stores it); the Claude GitHub app is installed on the organisation |

## Decisions

| Question | Choice | Why |
|---|---|---|
| One workflow or two | Two | Different triggers (the picture review has a `paths` filter and costs nothing when no picture changes), prompts, turn limits and timeouts; each can be switched off or fail alone. |
| Events | `pull_request` into main: opened, reopened, ready_for_review, synchronize | A push after a review is reviewed again, only the new commits (the skill reads its earlier comment's `head=` marker). No `merge_group`: the queue never waits for a reviewer. No `pull_request_target`, `workflow_run`, schedule or dispatch: those run with this repository's secrets or on code nobody read. |
| Forks, bots, drafts | The job is skipped unless the branch is in this repository, the pull request is not a draft and neither its author nor the actor is a bot | GitHub withholds the secret from fork pull requests anyway; the guard makes the job skip rather than fail. The action itself rejects bot actors and non-writers; `allowed_bots` is not set. |
| Trivial changes | `claude-review-needed.sh`: a change of only task files, bug files, documents and baseline pictures is not code-reviewed | Nothing to read for a code review; the pictures have their own review. |
| Runaway | `concurrency` per pull request (a push cancels the older run), job `timeout-minutes` 20 and 25, `--max-turns` 25 and 30, one comment of output | Cost is the subscription's, so every limit is explicit. |
| Model | `claude-sonnet-5-5`, overridable with the repository variable `CLAUDE_REVIEW_MODEL` | Strong enough to read a diff and a picture at a subscription cost that fits every pull request; switch to an Opus model with the variable for a hard one. |
| Advisory or blocking | Advisory, but loud | The last step reads Claude's `Verdict:` comment and turns `CONCERNS`, or no verdict at all, into a **red check** on the pull request, next to `pr-gate`. It is not in `pr-gate`'s `needs`, so it cannot stop a merge by itself (a test checks that). A red mark in the list of checks, plus inline comments, is hard to miss; the lead must fix each finding or answer it on the pull request before queueing (an answer from a person, not an AI, closes it). A review that produced nothing (turn limit, tool error) is red too: it did not happen. If it proves reliable, the check can be made required later by naming it in the ruleset. |
| Least privilege | Workflow `permissions:` empty at the top, job `contents: read` and `pull-requests: write`, no `id-token`; the workflow token is passed as `github_token` | The Claude app's own token can write contents and workflows; passing the workflow token means the review cannot push, whatever it is told. Claude's tools are a short list: read, search, `Write` (for the comment file), read-only `git`, `gh pr view`, `gh pr comment`, the inline-comment tool. No `gh api`, no push, no merge, no web. |
| Supply chain | `anthropics/claude-code-action` pinned to a commit (v1.0.266, 31 Oct 2026), no plugin marketplace | The step holds a credential. The review recipe is in this repository's skills, so it changes only by a reviewed pull request. |
| Prompt injection | Skills treat the pull request text, the diff and picture text as data; the prompt carries only numbers; the authors have write access | Public repository, but only collaborators' branches run. |

## Switching it off

- Quickest, no pull request: set the repository variable `CLAUDE_REVIEW` to `off` (Settings, Secrets and variables, Actions,
  Variables, or `gh variable set CLAUDE_REVIEW --body off -R portingle/openisd`). Both jobs then skip on every pull request.
  `gh variable delete CLAUDE_REVIEW -R portingle/openisd` turns it back on.
- Or `gh workflow disable claude-review.yml` / `claude-review-pictures.yml`.
- Stop the spend entirely: delete the secret `CLAUDE_CODE_OAUTH_TOKEN`; the jobs then fail at once and nothing is billed.

## What cannot be seen before merge

A workflow that holds a secret runs on a pull request from its own branch's copy, but the first run of anything new is only
real when it is on main and a real pull request goes through it. Watch the first pull requests: do the inline comments
appear, does the verdict comment carry the marker line, is the check red for `CONCERNS`, does the action accept the
workflow token as `github_token` without `id-token`, and does a picture-only pull request get a sheet-based review.
`scripts/land/test/claude-review-workflows.test.sh` proves the shape (events, permissions, secret use, pinning, limits,
tool list, not in `pr-gate`), the skip rule, the verdict script and the picture prep; it cannot prove what Claude says.
