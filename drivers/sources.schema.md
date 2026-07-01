# `sources.json` schema (v2)

Federated driver-data source registry read by the in-app driver browser
(`DriverBrowser.vue`) and the bundler (`scripts/bundle-drivers.mjs`).

## Top level

| Field         | Type    | Notes                                                          |
| ------------- | ------- | -------------------------------------------------------------- |
| `$schema`     | string  | Path to this document.                                         |
| `version`     | integer | Schema version. Currently `2` (keyed map; v1 was an array).    |
| `description` | string  | Human summary of the registry.                                 |
| `sources`     | object  | **Map** of source-id → source entry (see below). Not an array. |

## Source entry (each value in `sources`)

The **key** is a short, stable source id — for bundled sources it is the
`drivers/<key>/` folder name (`matt`, `scan-speak`, `demos`, …); for federated
sources it is a short slug (`mwisbest-winisd`). The key never changes once
published; it is half of every driver's identity.

| Field         | Type   | Notes                                                                                                    |
| ------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `name`        | string | Display name shown in the browser's source tag. Keep it clean — no "(bundled)" noise.                    |
| `url`         | string | GitHub tree URL. If it matches `github.com/Johnlon/resonate/tree/<branch>/<path>` the source is **bundled** (walked at build time into `drivers-bundle.json`); otherwise it is **federated** (fetched live from the GitHub API at runtime). |
| `description` | string | Provenance, count, licence notes, and the refresh command where applicable.                              |
| `license`     | string | Licence / attribution.                                                                                   |

## Driver identity — hard rule

A driver's unique identity is **`<source key>` + `<path within that source>`**,
never its display name (Brand + Model legitimately repeats — two dated files of
the same driver share one name). The bundler emits each file's `path` (relative
to the source folder, forward-slashed) alongside the source `key`; the browser
keys its `v-for` list on `sourceKey + '/' + path`. See the "Unique list-key rule"
in `.claude/context/ui-rules.md`.

## Adding a source

Open a PR that adds a keyed entry under `sources`. For a bundled collection the
key is the `drivers/<key>/` folder name and the `url` points at that folder in
this repo; run `node scripts/bundle-drivers.mjs` to regenerate the bundle.
