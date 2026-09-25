# OpenISDProject stored its driver as pre-serialised text, never as the live domain object

Status: FIXED (this change)

## Symptom

`OpenISDProject` (`packages/model/src/openisdProject.ts`) held every other part of a design —
box, target, filters, environment, signal, listening, sim options, sweep, meta — as a real
typed object for the object's whole lifetime. The driver was the one exception: the instant a
caller handed it a live `OpenISDDriver` via `setDriver()`, the object was thrown away and only
its serialised TEXT (`OpenISDDriver.toOwdrText()`) was kept. Every reader that needed the
driver as an object (`ManagedOpenISDProject`'s `layerOf()`/`mutate()`) had to re-parse that text
back into a fresh `OpenISDDriver` instance on every access.

John's ruling: "there is never a state where the project is an object and the driver is text -
its either all domain object or all INI text."

## Evidence

Before this change, `packages/model/src/openisdProject.ts`:

    driverText(): string | undefined { return this.#record.driver; }

    setDriver(driver: OpenISDDriver | undefined): void {
      this.#record.driver = driver?.toOwdrText();
    }

`packages/ui/src/logic/managedProject.ts` re-parsed that text on every load and every mutation:

    function layerOf(project: OpenISDProject): Layer {
      const text = project.driverText();
      return { project, openIsdDriver: text ? OpenISDDriver.fromOwdrText(text) : null };
    }
    // ...
    mutate(fn: (project: OpenISDProject) => void): void {
      const layer = this.#effective();
      fn(layer.project);
      const text = layer.project.driverText();
      layer.openIsdDriver = text ? OpenISDDriver.fromOwdrText(text) : null;
      this.#notify();
    }

## Cause

`setDriver()` took the correct type (the public `OpenISDDriver` class, per QO73's ruling that
UI code may never name or infer the driver's private record shape), but then immediately
converted it to text for storage instead of holding the object. QO73 was about the record shape
never crossing a boundary as a NAME — it was never a rule that the live object could not be
held internally. The text conversion was happening at adoption time (`setDriver`), not at the
one place text conversion actually belongs: the final wire-serialisation step.

## Fix

- `OpenISDProject`'s internal live state (`ProjectLiveState`, not exported — internal only)
  holds `driver: OpenISDDriver | undefined` directly, for the object's whole lifetime. `setDriver()`
  now just assigns it; there is no text round-trip at adoption.
- `_OpenISDProjectJson` (the WIRE record `toJsonRecord()`/`fromJsonRecord()` produce and adopt)
  keeps `driver` as data — the driver's own JSON record (`_OpenISDDriverJson`, named openly, held
  opaque) rather than escaped text, so a saved project nests real JSON instead of a JSON string
  escaped inside JSON.
- `toJsonRecord()`/`fromJsonRecord()` are the ONE place the live object and its wire projection
  cross — `driver?.toJsonRecord()` on the way out, `OpenISDDriver.fromConformingRecord(driver)`
  (checked, since a wire record is untrusted input) on the way in.
- `copy()` clones the driver via `OpenISDDriver.copy()` (a live class instance cannot go through
  `structuredClone`, which drops its private field data) and `structuredClone`s everything else.
- `ManagedOpenISDProject.layerOf()`/`mutate()` (`packages/ui/src/logic/managedProject.ts`) read
  `project.driver()` directly — no re-parse, no re-materialisation.
- `packages/persistence/src/repos/projectRepo.ts`'s `ProjectRepo` interface now takes/returns
  `OpenISDProject` directly instead of a hand-assembled `ProjectPayload` struct that re-declared
  `params`/`box`/`meta`/`driverText` as separate fields duplicating what the domain object
  already is (a second, parallel serialisation path for the same data).

## Verification

- `packages/model/test/openisdProjectWinIsdMapping.test.ts`: `setDriver` holds the SAME live
  object (`assert.equal(project.driver(), driver)`), and `toJsonRecord()`/`fromJsonRecord()`
  round-trip a driver through its own JSON record without ever handing back the original
  instance.
- `npm run typecheck` — clean across engine/model/winisd/ui/persistence.
- `npm run lint` — clean (one pre-existing unrelated warning).
- `npm run test:unit` — full suite green.
- `packages/ui/test/ui/architecture.test.ts`'s two named containment tests still pass unchanged:
  "ManagedOpenISDProject never hands an OpenISDDriver out" and "nothing outside managedProject.ts
  imports the OpenISDDriver value".
