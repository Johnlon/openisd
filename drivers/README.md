# Driver library & federation

Resonate's driver data is meant to be an open commons — but a commons doesn't
have to live in one place. Two ways drivers reach the tool:

1. **Bundled** — `.wdr` files committed here in `drivers/`.
2. **Federated** — links to *other people's* driver libraries, listed in
   [`sources.json`](sources.json). Resonate's in-app **driver browser** reads
   those sources and fetches `.wdr` files on demand, so we link instead of copy.
   No re-hosting, no staleness, the original maintainer stays in control.

You can also paste **any** GitHub repo of `.wdr` files into the browser to read
it ad hoc, without it being in the list.

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

- `type` — currently `github` (the browser enumerates files via the GitHub API
  and fetches raw content; both allow cross-origin reads).
- `path` — `""` for repo root, or a subfolder like `"drivers"`.
- Only metadata lives here — the driver files stay in the source repo.

## Add a bundled driver

Drop a `.wdr` file in this folder and open a PR. Import the spec sheet in the
app first and sanity-check the curves; note your source in the PR.

## File format

`.wdr` is WinISD's driver format: INI-style text, a `[Driver]` section of
`Key=Value` lines in SI units. Resonate imports the core T/S set and re-derives a
self-consistent parameter set (scraped files are often internally inconsistent).

## Provenance

- The bulk of this library (~420 mostly car-audio sub drivers) comes from a
  community `.wdr` collection shared by *mtg90* on AVS Forum:
  <https://www.avsforum.com/threads/common-sub-driver-winisd-files.2928258/>.
  Each file parsed and derived to a finite, consistent T/S set before inclusion
  (one file with incomplete parameters was dropped). T/S parameters are factual
  measurements; these files are bundled to seed the open commons.
- A handful (Beyma, Dayton, SB Acoustics, Tang Band, Visaton) are from the
  maintainer's own WinISD library.

Spotted a wrong number? Open a PR — the point of an open commons is that anyone
can correct it.
