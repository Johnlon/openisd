# Driver library

Related docs:
[`WINISD_SCHEMA.md`](../docs/design/WINISD_SCHEMA.md) — WDR field spec ·
[`BACKLOG.md` "Driver type classification and matching"](../BACKLOG.md) — the driver file model ·
[`DRIVER_TYPES.md`](DRIVER_TYPES.md) — classification rules ·
[`VENDOR-APIS.md`](VENDOR-APIS.md) — vendor API research

OpenISD's driver data is an open commons. The app consumes one bundled corpus from the sibling
`winisd_drivers/db/datasheets` checkout. A record is `<driver>/openisd.yml`, written by
winisd_tools; it carries the T/S values, provenance and quality together.

You can also paste any GitHub repo of `.wdr` files into the browser ad hoc.

The bundler reads that corpus directly. Other directories under `drivers/` are reference material
unless a later product decision gives them an explicit consumer.

## Directory guide

| Directory | What it is | Details |
| --- | --- | --- |
| [`myprobes/`](myprobes/README.md) | WDR files created by manually probing the WinISD app itself — dummy/sentinel values used to reverse-engineer WinISD's field and `ParState` behaviour. **Not real drivers.** | [`myprobes/README.md`](myprobes/README.md) |
| [`winisdpro/`](winisdpro/README.md) | **Legacy.** Driver files pulled from an old WinISD distribution (circa 2006 or earlier). They do not match the modern WDR format — notably they lack `ParState`, and other fields may differ too. Historical/fallback reference only. | [`winisdpro/README.md`](winisdpro/README.md) |
| [`matt/`](matt/README.md) | A collection of real driver files sourced from online (AVS Forum, contributor mtg90). These appear to match the format produced by the latest WinISD Pro, making this collection a better oracle for "what would a human actually produce" than the legacy `winisdpro/` archive. | [`matt/README.md`](matt/README.md) |

None of the three are wired into the app's bundled corpus — that's `winisd_drivers/db/datasheets`
only (see above). Each subdirectory's own README has the full detail; do not add any of them to
the bundled corpus without checking with the human first.

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
