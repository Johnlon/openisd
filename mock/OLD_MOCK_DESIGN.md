# Mock design notes / open questions

Running tracker for design decisions and open questions raised while building
`mock/`. Distinct from `MOCK_PROMPTS.md` (verbatim prompt log) — this file is
the *answers and decisions*, kept up to date as things get resolved.

## Answered questions

### Can the SPA auto-load a local WDR/WPR file without the user picking it?

No. Browser security sandboxing means a web page can never read an arbitrary
file from disk on its own — there is no path a real app could take around
this. The user must explicitly hand the file over, either via:
- a classic `<input type="file">` picker, or
- drag-and-drop onto the page, or
- the File System Access API (`showOpenFilePicker` — Chromium-only, not in
  Firefox/Safari), which additionally lets the app remember a *handle* and
  write back to that same file later in the session, still gated on an
  initial user grant.

So: no auto-load, ever. Every "open project/driver" action is a user gesture.

### Can it save to local browser storage?

Yes. `localStorage` (or IndexedDB for anything bigger/structured, like a
whole "My Drivers" library) persists across page reloads and browser
restarts — it is not RAM-volatile. That's the natural home for a "My
Drivers" custom-driver library and for autosave/recovery of the current
in-progress project, without needing a file at all.

### Can it save into "volatile project WPR storage"?

Yes, trivially — that's just the in-memory JS state of the currently open
project. It's volatile in the sense that it's lost on tab close/refresh
unless also persisted (to localStorage as a draft, or exported as a file).

### Can the toolbar Save button write back to the original file on disk?

Only in Chromium via the File System Access API, and only if the file was
originally *opened* through that same API (giving the app a writable
handle) — not for a plain `<input type=file>` open, which only ever gives
read access to a snapshot. For a cross-browser app, the safe assumption is:
**Save always produces a fresh download** (a "Save As" to the downloads
folder or wherever the browser puts it), never a silent overwrite in place.

### Can the toolbar Save as... button write to file on disk?

Yes, in the same "always a fresh write, never a silent overwrite" sense as
plain Save — every browser can trigger a download (bytes land on disk
somewhere), but only Chromium's File System Access API
(`showSaveFilePicker`) lets the app present an actual native "choose a
location/filename" dialog and get back a handle it can write to again
later in the session. In Firefox/Safari there's no way to force that
picker from JS — the browser's own download settings decide where the
file lands (silently to the Downloads folder, or its own built-in prompt,
per the user's browser preferences); the app can only *suggest* a filename
via the `download` attribute on the trigering link. So: "Save As" is real
and does write a file, but "as" (the choosing-where part) is a Chromium-only
guarantee, not a cross-browser one.

### Driver Editor Save — does it overwrite the built-in/common driver store?

No — and it shouldn't be able to. Built-in drivers are shipped data, not
user data. The mock's Driver Editor "Save" button tooltip now says it more
plainly: it writes into *this driver's* entry, framed as the shared driver
library, not the project. The real distinction the app needs is:
- **Customise** (see below) clones a built-in driver into a user-owned "My
  Drivers" entry (localStorage/IndexedDB) — only *that* can be edited/saved/
  deleted going forward.
- A raw **Save-driver-to-.wdr-file** export is a separate, always-available
  action (any driver, built-in or custom) — a download, not an overwrite.

## Design decision: What-If was mis-scoped, replaced by Select vs Edit

Original plan (tasks #7/#13) was a distinct global "What-If mode" toggle.
Superseded by this realisation: **every field edit before the project is
saved is already a what-if** — there's no meaningful separate mode. What the
app actually needs is two distinct actions on the Driver tab:

- **Select driver** — pick a different driver into the *current project's*
  WPR model. Does not touch the original WDR file or "My Drivers"; purely
  swaps which driver's values the project is currently using. Can be
  re-edited afterwards (see Edit).
- **Edit** — opens the Driver Editor modal and edits the values already
  living in the current project's WPR model in place.

Then a separate **Manage Drivers** entry (top nav) covers the
library-management actions that don't belong on the per-project detail
pane: Customise-to-My-Drivers, Save-as-new, Edit-custom-driver (never
built-ins), Delete-custom-driver, Disable-custom-driver (hide from pickers
without deleting).

The old "drag a field to explore, then Apply/Exit" what-if-mode idea is
dropped as a separate mode. The spinners/color-coding/drag-to-adjust
interaction ideas still apply — just to *Edit*, not to a distinct mode.




## Open Quston - editor concept rework

                                                                                                                                                    if we are going to havve Select Driver / Edit Driver btn on Driver tab then the full blown Edit Driver wont ne reactie                              but I want the equive of what if - so the currebt main app (not mock) 'whatif' JJopens an little moinimal overlay that sits out of the way of the charts -
take a look and consider same.
given my move away from whatif then we still need a reative edit.
Edit (Full) / Tune (reactive minimal) both of which have Reset / Done / Cancel / Save to My which asks the name but doen't dismiss



## Open question — Box tab / Vents-PR-bandpass tab merge

Raised, not yet decided: should the Box pane grow a right-hand column (with
a vertical divider) holding the vent/PR/bandpass-specific fields that
currently live on their own nav tab, eliminating that separate tab
entirely? This would also make a single-pane what-if/edit experience
simpler (one place to see chamber vol/tuning *and* the vent geometry at
once).

**Recommendation:** yes, worth doing — it matches how the real WinISD
groups "Rear chamber" + "Vents" under one Box-adjacent concept already (see
`view_3_ported.png`/`view_2_box.png` notes), and it removes a tab whose
label has to context-switch (Vents/Passive Radiator/Sealed) depending on
enclosure type, which was already the awkward part of the current
implementation. Tradeoff: the combined pane needs enough width for two
columns plus the box illustration, which may push the Box tab layout to
need its own wider treatment rather than reusing the generic two-column
pattern. Deferred until the box-type cascade (6 enclosure types) is
implemented, since this changes that work's shape.
