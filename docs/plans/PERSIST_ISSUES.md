# PERSIST_ISSUES — Save/Open/Export is broken after the model→design move

## Background (plain terms)

The app used to get its driver logic from a code package called `packages/model`. On
2026-08-31 you told us to switch that package off. Its replacement (`packages/design`) was
only half-wired when that happened, so the UI code that still calls the old package no longer
compiles — 173 type errors.

Two files carry almost all of it:

- **`useDesignIO.ts`** — the code behind the **Save**, **Save As**, **Export**, **Open**
  buttons. It handles _which file, what filename, show a "saved" message_ and hands off the
  actual file-format work to other code. That other code (the `.wdr`/`.wpr` converters) is now
  missing the methods this file calls.
- **`driverBrowsingState.ts`** — the code behind the **driver picker** (the search box, the
  type chips, the "My Drivers" list, the little spec summary next to each driver). It calls
  eight helper functions that got commented out during the switch-off and never rehomed.

File types involved:

| Extension | What it is                                          |
| --------- | --------------------------------------------------- |
| `.wdr`    | WinISD's own driver file                            |
| `.wpr`    | WinISD's own project file (box + driver + settings) |
| `.owdr`   | our driver file (same data, our JSON layout)        |
| `.owpr`   | our project file                                    |

`packages/design/winisd/` already has working, tested functions that convert between our data
and WinISD's file text. The open questions are all about **where the glue code goes** and
**what it's called**.

Each issue: what's broken → why you care → the options → the recommendation → your ruling.

---

## 1. The Save/Export/Open code calls six methods that don't exist

### Broken

`useDesignIO.ts` calls, on the current project object:

- `exportDriverWdr()` — give me the driver as `.wdr` bytes
- `exportDriverOwdr()` — give me the driver as `.owdr` bytes
- `exportWpr(date, curves, lossMode)` — give me the whole project as `.wpr` bytes
- `importWpr(bytes)` — load a `.wpr` file into this project
- `loadDriverFromWdrText(text)` — load a driver from `.wdr` text
- `loadDriverFromOwdrText(text)` — load a driver from `.owdr` text

None of these exist any more. The working converter functions do exist, one level down, in
`packages/design/winisd/`, but nothing connects the buttons to them.

### Why you care

Save-as-`.wdr`, save-as-`.wpr`, and opening a `.wdr`/`.wpr`/`.owdr` file are all dead in the
app right now.

### Options

| Option                                  | What it means                                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Put the six methods on the project   | Add `exportDriverWdr()` etc. as methods on the project object; each one calls the converter function. Button code stays as-is. Downside: the project object now knows about file formats. |
| B. Button code calls the converters raw | `useDesignIO.ts` imports the converter functions directly and does the wiring itself. No new methods anywhere. Downside: file-format knowledge spreads into the button code.              |
| C. One new glue file in the middle      | A new file (name below) holds the six operations, each wrapping a converter. The button code calls that file; the project object stays clean.                                             |

### Recommendation

**C.** The converters already exist and are tested. A small glue file that adapts them to
"current project + the live graph curve + the download plumbing" is the honest fit. `.wpr`
export in particular needs the on-screen impedance curve, which only the UI has — so it can't
live on the plain project object anyway.

**Name for the new file: `winisdFiles.ts`** (it converts our data to/from WinISD's file
formats). Not `designFileIo.ts` — "IO" and "Design" were noise.

### RULING (2026-09-07)

**C — a new glue file owned by the Save/Export code.**

---

## 2. Loading a driver from a file needs a new project method

### Broken

`loadDriverFromWdrText` / `loadDriverFromOwdrText` don't exist, so "open a driver file into the
current project" has no path.

### Why you care

The picker can browse the built-in driver library, but the user can't bring in their own
driver file.

### Options

| Option                                          | What it means                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. One method: `loadDriver(driver)`             | Caller turns the file text into a driver object first (using an existing converter), then calls `project.loadDriver(driver)`. Same operation as the existing `setDriver()`, just with a clearer name and a rule that the driver must be a standalone one, not one already embedded in another project. Deep-copies, so the loaded driver and the file's driver don't share memory. |
| B. `loadDriver(driver)` plus two text shortcuts | Also keep `loadDriverFromWdrText(text)` / `loadDriverFromOwdrText(text)` as one-line shortcuts that parse-then-call `loadDriver`, so the Save/Export code changes less.                                                                                                                                                                                                            |
| C. Something else — you spell it out            |                                                                                                                                                                                                                                                                                                                                                                                    |

### Recommendation

**A.** `setDriver()` already does "project takes on a different driver". `loadDriver` is the
same thing with a guard and a name that says where the driver came from. One copy path, and
nothing in the project object needs to know about file formats.

### RULING (2026-09-07)

**B — `loadDriver(driver)` plus the two text shortcuts.** Also: raise a to-do to come back and
check this area for duplication — `loadDriver`, `setDriver`, and the internal `update()` are
near-identical "replace the driver" paths, and the two text shortcuts may not be worth keeping.
**→ QO119.**

---

## 3. The new glue file needs an "engine" object — where from?

### Broken

The converter functions each need an `engine` object passed in (it does the physics maths).
The app builds exactly one engine at startup, inside `appState.ts`, and doesn't share it out.

### Why you care

Every function in the new glue file needs it. The choice is: pass it in as plumbing, hand it
out from `appState.ts`, or build a second engine.

### Options

| Option                                                   | What it means                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Pass the engine in when the Save/Export code is built | Startup code already holds the engine; add it to the bundle of things handed to the Save/Export code, which passes it to the glue file. No new shared state. |
| B. Let `appState.ts` hand the engine out                 | Add one export to `appState.ts` so the glue file can grab it directly. Slightly less plumbing, one more thing exported from `appState`.                      |
| C. The glue file builds its own engine                   | Simplest wiring, but now the app has two engine objects. They're just config (no state), so behaviour is identical — it's still a second one.                |

### Recommendation

**A.** Matches how the Save/Export code and the driver library code are already built (startup
assembles them and hands in what they need). No new shared state, no second engine.

### RULING

_(pending)_

---

## 4. Is the new glue file a plain set of functions, or a "built object"?

### Broken

Nothing — it's a style choice, but it has to be settled before the file is written.

### Why you care

The files around it split two ways: some are "build it once at startup, then call its
methods"; others are just a bag of functions you import. Picking the heavier pattern here
would add ceremony for nothing.

### Options

| Option                    | What it means                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Plain functions        | `exportDriverWdr(project, engine)`, `importWpr(project, bytes, engine)`, etc. Import and call. Nothing to build.                           |
| B. "Built object" pattern | Matches the Save/Export code and the driver library code for consistency. But there's no state to hold, so the "build" step wraps nothing. |

### Recommendation

**A.** No state to hold. The engine arrives with each call (issue 3, option A). The
built-object pattern here would be a wrapper that earns nothing.

### RULING

_(pending)_

---

## 5. Opening a `.wpr` file — replace the current project, or edit it in place?

### Broken

The converter (`.wpr` text → project) hands back a **brand-new project object**. The current
Save/Export code expects `importWpr` to return only the project's _description / author /
dates_, and expects something else to swap in the new box + driver + settings. That
"something else" doesn't exist — there's no "overwrite everything" method on a project.

### Why you care

One choice forces a new "overwrite the whole project" method onto the project object. The
other means opening a `.wpr` gives you a genuinely new project (new entry in the open-projects
list, the retained file handle is dropped, etc.). Opening our own `.owpr` JSON file _already_
does the "new project, swap it in" thing — so making `.wpr` behave the same keeps one path
instead of two.

### Options

| Option                                                      | What it means                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Build a new project, swap it into the open-projects list | `.wpr` open produces a new project; the app swaps it in and names it after the file. Exactly what `.owpr` open already does. The old project object is replaced.                                                                                                        |
| B. Edit the current project in place                        | Add an "overwrite my box, driver and settings from this other project" method. The `.wpr` open builds a throwaway source project and copies its fields across. Same project object stays, but it needs a new bulk-overwrite method whose only user is this one feature. |
| C. Something else — you spell it out                        |                                                                                                                                                                                                                                                                         |

### Recommendation

**A.** Opening a `.wpr` replaces the entire design — box, driver, settings, metadata. That's a
new project, not an edit. Reusing the existing `.owpr` path means one code path for both.
Option B invents a method used in exactly one place.

### RULING

_(pending)_

---

## 6. Eight picker helper functions have no home

### Broken

Eight functions were commented out in `packages/persistence/driverRepo.ts` during the
switch-off, and `driverBrowsingState.ts` (the picker) still imports them:

| Function                  | What it does                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `driverKey`               | a unique id for a driver row (for favourites, list keys)                             |
| `myDriverEntry`           | turns a saved driver into a picker row                                               |
| `myDriverName`            | the display name for a saved driver                                                  |
| `matchesCriteria`         | the search/filter test — does this row match the search box + chips + Fs/Sd/Z bounds |
| `previewOf` (+ `Preview`) | the spec summary shown next to a driver (Fs, Sd, links, etc.)                        |
| `fmtHz`                   | format a frequency for display                                                       |
| `shortSource`             | shorten a source name for display                                                    |
| `driverHasDqIssues`       | should this driver show the ⚠ "data quality" badge                                   |

They read driver fields (Fs, Sd, nominal impedance, quality info) and used to lean on helpers
from the now-dead `packages/model`.

### Why you care

`driverBrowsingState.ts` is the one and only driver picker. It doesn't compile. The entire
driver-selection UI is down.

### Options

| Option                                 | What it means                                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Put all eight back in `persistence` | Rewrite them to read fields through the driver object's own methods. Smallest change in shape.                                                                                                                                                                   |
| B. Split them by job                   | The display/format/search ones (`previewOf`, `fmtHz`, `shortSource`, `myDriverName`, `matchesCriteria`, `driverHasDqIssues`) move to the UI display layer next to `driverDisplay.ts`. The two pure-id ones (`driverKey`, `myDriverEntry`) stay in `persistence`. |
| C. Make some of them driver methods    | `previewOf` / `driverHasDqIssues` become `driver.preview()` / `driver.hasDqIssues()`; `matchesCriteria` stays a standalone test.                                                                                                                                 |

### Recommendation

**B.** Formatting and filtering for one screen is display code — it belongs in the UI display
layer next to `driverDisplay.ts`. The two id functions are storage concerns and stay put. All
field reads get rewritten to go through the driver object's own methods.

### RULING (2026-09-07)

**B — move the display/format/search helpers to the UI display layer (`driverDisplay.ts`);
`driverKey` and `myDriverEntry` stay in `persistence`.** Also: raise a to-do to hand-check the
moved code — whether `driverHasDqIssues` still means the same thing without the old
`packages/model` helpers (it drives the ⚠ badge), whether `previewOf` duplicates a summary that
already exists on the driver object, whether `myDriverName` duplicates the driver's own
`displayName()`, and where the old type-classifier (`classifyTypes`) ended up. **→ QO120.**

---

## Not covered here

The other ~120 type errors are all in test files (`persist.test.ts` ~53,
`store-issue-channel.test.ts` 29, `vent-group-solve-coalescing.test.ts` 20, `chart-types.test.ts`
8, `round-trip-gate.test.ts` 5, and a few more). They call project setter methods
(`setActiveBoxType`, `setBoxVolume_m3`, ~50 of them) and import from `packages/model`, neither
of which exists now. Whether those setters come back or the tests are rewritten to the new API
is a separate decision.
