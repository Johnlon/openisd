# Driver library

Related docs:
[`WDR_SCHEMA.md`](../WDR_SCHEMA.md) — WDR field spec and `_meta.yml` sidecar format ·
[`SCRAPING_RULES.md`](SCRAPING_RULES.md) — unit conversions, Xmax conventions, brand names, standard fixes ·
[`WDR_FILE_MODEL_AND_WORKFLOWS.md`](WDR_FILE_MODEL_AND_WORKFLOWS.md) — link-field workflows, DQ check, scripts reference ·
[`DRIVER_TYPES.md`](DRIVER_TYPES.md) — classification rules ·
[`VENDOR-APIS.md`](VENDOR-APIS.md) — vendor API research

Resonate's driver data is an open commons. Two ways drivers reach the tool:

1. **Bundled** — `.wdr` files in subfolders here. Each driver has a `_meta.yml` sidecar
   with provenance and quality metadata.
2. **Federated** — links to other people's driver libraries in [`sources.json`](sources.json).
   The in-app driver browser reads those sources and fetches `.wdr` files on demand —
   no re-hosting, no staleness, the original maintainer stays in control.

You can also paste any GitHub repo of `.wdr` files into the browser ad hoc.

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

## Underscore-prefix convention — excluded from the app bundle

Any directory inside `drivers/` whose name starts with `_` is **invisible to the app**.
`scripts/bundle-drivers.mjs` skips all `_`-prefixed directories when it walks the tree,
so their contents are never included in `drivers-bundle.json` and Vite never sees them.

Current `_`-prefixed directories and what they hold:

| Directory                    | Contents                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `<collection>/_html/`        | Cached HTML pages from the scraper — large, gitignored, regenerable                     |
| `<collection>/_problems.log` | (file, not dir) Scraper problem log — not excluded by this rule                         |
| `<collection>/datasheets/`   | Cached PDFs — large, gitignored. Note: no `_` prefix; excluded via `.gitignore` instead |

**Rule:** if you need to add a working directory, cache directory, or scratch space inside
`drivers/`, prefix its name with `_` so the bundle walker automatically ignores it.

## Add a bundled driver

Create or use an appropriate subfolder, drop a `.wdr` file there, create a `_meta.yml`
sidecar with provenance fields, and open a PR. Import the spec sheet in the app first
and sanity-check the curves.

Spotted a wrong number? Open a PR — the point of an open commons is that anyone can
correct it.
