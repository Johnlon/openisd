# Contributing to OpenISD

You do not need to be an acoustician. If you can edit a Vue component or open a pull request, you
can contribute.

## Quick start

Read [ARCHITECTURE.md](ARCHITECTURE.md) and [TESTING_STRATEGY.md](TESTING_STRATEGY.md), then:

```bash
npm install && npm run ci
```

Pick work from [BACKLOG.md](BACKLOG.md).

## Rules that catch people out

- The bundled driver catalogue is built from the sibling `winisd_drivers` repository, which only
  `winisd_tools` writes. Fix a wrong value there, never in the app. `drivers/` here holds
  reference `.wdr` collections only.
- `drivers/matt/` is human-curated and off-limits to any script or agent.
- Formulas, physical constants, display precision and defaults that affect a result change only
  with maintainer approval.
- Tests come first: write the failing test, watch it fail, then fix. A skipped test is a failure.

## Where to start reading

- Layers and the domain model: [ARCHITECTURE.md §2–3](ARCHITECTURE.md#2-packages-and-layers).
- Solving and the circuit: [ARCHITECTURE.md §4](ARCHITECTURE.md#4-solving).
- Formulas with test citations: [docs/spec/SPEC_ENGINE.md](docs/spec/SPEC_ENGINE.md).

## Pull requests

Keep changes focused; describe what and why. If it touches the engine, paste the test output. By
contributing you agree your work is released under the project's MIT licence.
