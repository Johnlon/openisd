---
name: safe-tools
description: Optimise agent permissions by turning broad, repeatedly-prompted commands into SAFE RESTRICTED CLI tools that can be blanket auto-approved. Use when you notice yourself issuing the same unrestricted shell command (search, read, list, fetch, count) often, when a permission prompt keeps recurring, or when the user asks to reduce prompts / harden tool access. Ethos: least privilege, project-scoped, read-only, whitelisted, no traversal, no exec.
---

# Safe restricted tools

The goal: **fewer permission prompts without widening what the agent can actually do.** You get there not by granting `Bash(grep:*)` (which can read any file on the machine) but by building a _confined_ replacement that is safe to grant blanket, then allow-listing that.

For in-project content search, prefer the built-in `Grep` tool over building a bespoke wrapper — it already meets the ethos below without extra maintenance.

## When to reflect and propose a tool

Trigger on any of:

- You've issued the **same broad command 2+ times** and it prompted each time (or you wish it were auto-approved).
- A command reaches **outside the project** or has more power than the task needs (`grep -r` over `/`, `cat` of arbitrary paths, `find … -exec`, `curl` to an arbitrary host).
- The user asks to **reduce prompts, harden permissions, or lock a tool down**.

When triggered, stop and ask: _what is the minimum capability this task actually needs, and can I express it as a project-scoped read-only tool?_ If yes, build it.

**Before building, verify the invocation actually avoids prompts.** The permission matcher only allow-lists a literal, non-compound command line. It is not just pipes/`&&`/redirects that break the match — a quoted search pattern, a glob, or any regex metacharacter *in the tool's own arguments* is enough to make the call look like an expansion and trigger a prompt anyway, allow-list or not. If the capability you're wrapping needs free-form pattern/query arguments (a grep-like search, a flexible fetch), a Bash-wrapper script will likely keep prompting on every real call and buys nothing over the raw command. Check first whether a built-in tool (`Grep`, `Glob`, `Read`, `WebFetch(domain:...)`) already covers the need — those never prompt at all, regardless of argument content — before spending effort on a wrapper.

## The ethos — every safe tool must be

1. **Least privilege** — does exactly one job; no general-purpose escape hatches.
2. **Project-scoped** — root is computed from the tool's own location (not `$PWD`, not an env var a caller can override), and every path operand is resolved with `realpath -m` and rejected if it escapes root. Never infer containment from the string — resolve it, so symlinks and `..` can't escape.
3. **Read-only** — never writes, moves, deletes, or mutates. If a task needs mutation, it is out of scope for this pattern.
4. **Whitelisted functionality** — allow an explicit list of flags/modes; reject everything else (fail closed). Never blocklist — new dangerous flags you didn't foresee must be denied by default.
5. **No code execution** — reject `-exec`, `-f/--file`-style "read args/patterns from a file", command substitution, and anything that shells out.
6. **Safe to blanket-grant** — the above together mean `Bash(<tool>:*)` gives away nothing beyond the intended read-only, in-project capability.

If you cannot meet all six, do **not** create the tool — leave the command as a normal prompt.

## Recipe

1. **Write the script** under `.claude/tools/<name>/<name>` (Git Bash, `#!/usr/bin/env bash`, `set -euo pipefail`, the `MSYSTEM` guard). Compute root from `${BASH_SOURCE[0]}`, `cd` to it, parse args, whitelist flags, resolve+contain every path, then `exec` the real command with a reconstructed, sanitised argv. Put the access model in a header comment. `chmod +x` it.
2. **Prove the guard-rails** — test that it does the job on a valid in-project call **and** that it rejects: absolute paths, `..`/symlink escape, non-whitelisted flags, and any exec/file-read flag. A tool whose rejections you haven't watched fail is not proven.
3. **Allow-list it** in `.claude/settings.json` → `permissions.allow`: `"Bash(.claude/tools/<name>/<name>:*)"`. (Project settings, so it's shared and checked in.)
4. **Wire the preference** — add a row to the "Safe restricted tools" table in `CLAUDE.md` and a one-line rule telling agents to prefer it over the raw command.
5. **Tell the user** what you added and that they can grant/adjust the permission.

## Anti-patterns

- Granting the raw command (`Bash(grep:*)`, `Bash(cat:*)`, `Bash(find:*)`) — defeats the point.
- Root from `$PWD` or an env var — a caller can move/override it out of the sandbox.
- Blocklisting dangerous flags instead of whitelisting safe ones — you'll miss one.
- String-matching paths for containment instead of resolving them — symlinks and `..` slip through.
- A "read-only" tool that also has a write/format/fix mode bolted on — split it; keep this one read-only.
