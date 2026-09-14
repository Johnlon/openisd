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
