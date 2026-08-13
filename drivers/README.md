# Driver library

Related docs:
[`WDR_SCHEMA.md`](../docs/design/WDR_SCHEMA.md) — WDR field spec ·
[`BACKLOG.md` "Driver type classification and matching"](../BACKLOG.md) — the driver file model ·
[`DRIVER_TYPES.md`](DRIVER_TYPES.md) — classification rules ·
[`VENDOR-APIS.md`](VENDOR-APIS.md) — vendor API research

OpenISD's driver data is an open commons. Two ways drivers reach the tool:

1. **Bundled** — driver records in subfolders here. A record is `<driver>/openisd.yml`,
   written by winisd_tools; it carries the T/S values, provenance and quality together.
2. **Federated** — links to other people's driver libraries in [`sources.json`](sources.json).
   The in-app driver browser reads those sources and fetches `.wdr` files on demand —
   no re-hosting, no staleness, the original maintainer stays in control.

You can also paste any GitHub repo of `.wdr` files into the browser ad hoc.

**Only a directory listed in `sources.json` is loaded by the bundler/app.** A subfolder can
exist here without being an active source — `matt/` and `winisd/` (2026-07-31, human
decision) are reference material, not currently in `sources.json`; see their own READMEs.
Adding a subfolder here does nothing on its own until it's also added to `sources.json`.

## Add a federated source

Open a PR appending an entry to [`sources.json`](sources.json):

```json
{
  "name": "Your Library Name",
  "type": "github",
  "repo": "owner/repo",
  "branch": "main",
  "path": "subfolder-or-empty-string",
  "fileExtension": ".wdr",
  "url": "https://github.com/owner/repo",
  "description": "What's in it.",
  "license": "the source's license"
}
```

`path` — `""` for repo root, or a subfolder like `"drivers"`. Only metadata lives here —
driver files stay in the source repo.

## No scratch space here

`drivers/` holds driver data and nothing else. Working files, caches and scratch output go
in `build/` at the repo root (`AGENTS.md` §"Transient files live in `build/`"), where their
status is obvious and git ignores them.

A collection arriving from the pipeline that produced it may carry `_`-prefixed cache
directories (`_html/`, `_datasheets/`). Those are ignored by `.gitignore` and by Vite's
watcher, so they are never served, watched, or committed.

## Add a bundled driver

A driver record is `<collection>/<driver>/openisd.yml`, produced by winisd_tools from
the manufacturer's datasheet. Open a PR there, not here — this repo consumes records,
it does not author them. Import the spec sheet in the app first and sanity-check the
curves.

Spotted a wrong number? Open a PR — the point of an open commons is that anyone can
correct it.
