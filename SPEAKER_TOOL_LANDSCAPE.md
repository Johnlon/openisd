# Speaker modelling & design tool landscape

**Compiled:** 2026-07-04

A wide-ranging survey of loudspeaker enclosure/crossover/measurement tools, their feature
sets, cost, source-code availability, and community standing. Companion to
[`REPORT_ORACLE_CROSSCHECK.md`](REPORT_ORACLE_CROSSCHECK.md) and `OTHER_TOOLS.md`.

## Method & caveats

- Sources are **web searches + forum threads + project pages + GitHub/SourceForge**. Every
  non-obvious claim carries a link in the [Sources](#sources) list; claims drawn from a
  search-engine _summary_ (not a page I opened directly) are marked _(search)_.
- Prices, star counts and version numbers are **as of the cited source's date** and drift.
- I did **not** fabricate anything I could not source — notably YouTube view counts (I cite
  tutorial _existence/breadth_, not invented numbers) and the URL-state encoding schemes of
  the web SPAs (see [State-sharing note](#note-on-url-state-sharing)).

---

## Master comparison

| Tool                    | Type                    | Platform             | Cost                            | Source             | Enclosure coverage                    | Crossover                      | Measurement          |
| ----------------------- | ----------------------- | -------------------- | ------------------------------- | ------------------ | ------------------------------------- | ------------------------------ | -------------------- |
| **WinISD**              | Box sim                 | Windows              | Free (donationware)             | Closed             | Sealed, vented, bandpass + filters    | Basic                          | No                   |
| **VituixCAD**           | Full system             | Windows (.NET)       | Free (was €85 pre-1.0)          | Closed             | Sealed, vented, PR, BP, isobaric      | **Yes** (up to 6-way)          | Import FRD/ZMA       |
| **Hornresp**            | 1D horn/TL sim          | Windows              | Free                            | Closed             | Horn, TL, ¼-wave, BP, direct radiator | No                             | No                   |
| **Basta!**              | Box + xover             | Windows              | Free                            | Closed             | Sealed, vented, PR, BP                | Yes                            | No                   |
| **Boxsim**              | Full system             | Windows              | Free                            | Closed             | Multi-driver + baffle diffraction     | Yes                            | No                   |
| **XSim**                | Crossover               | Windows              | Free                            | Closed             | — (xover only)                        | **Yes**                        | No                   |
| **Speaker Workshop**    | Measure + design        | Windows              | Free                            | Closed             | Sealed, vented + xover                | Yes                            | Yes (sound card)     |
| **Akabak 3**            | Electroacoustic network | Windows              | Free edition (b102)             | Closed             | Arbitrary networks, horns, BP         | Yes                            | No                   |
| **Unibox**              | Box sim (Excel)         | Any (Excel)          | Free (non-commercial)           | Spreadsheet (open) | Sealed, vented, **PR**, bandpass      | No                             | No                   |
| **Bagby sheets**        | Xover + FRD (Excel)     | Any (Excel)          | Free                            | Spreadsheet (open) | — (response/xover modelling)          | Yes                            | No                   |
| **BassBox Pro 6**       | Box sim                 | Windows              | **~$140–149**                   | Commercial         | Sealed, vented, BP, PR                | (X-over 3 Pro sold separately) | No                   |
| **LspCAD**              | Full system             | Windows              | **$129 / $495 pro**             | Commercial         | Box + xover (active/passive)          | Yes                            | Yes (w/ hardware)    |
| **LEAP (LinearX)**      | Reference sim           | Windows              | Commercial (**vendor defunct**) | Closed             | Full                                  | Yes                            | Yes                  |
| **ARTA / STEPS / LIMP** | Measurement             | Windows              | **~$99–187** (freemium)         | Closed             | — (measurement/analysis)              | No                             | **Yes**              |
| **REW**                 | Measurement/EQ          | Win/mac/Linux (Java) | Free                            | Closed             | — (measure rooms/speakers)            | No                             | **Yes**              |
| **SpeakerBoxLite**      | Box sim (web)           | Browser (SPA)        | Free                            | Closed             | Sealed, vented, 4th/6th BP, PR, TL    | No                             | No                   |
| **Sine Design**         | Box + xover (web)       | Browser (SPA)        | Free                            | Closed             | Sealed, ported, bandpass, **PR**      | Yes                            | No                   |
| **micka.de**            | Box calc (web)          | Browser (form)       | Free                            | Closed             | Sealed, vented                        | No                             | No                   |
| **lautsprechershop**    | Box calc (web)          | Browser (static)     | Free                            | Closed             | Sealed, vented                        | No                             | No                   |
| **QSpeakers**           | Box sim                 | Linux/Qt             | Free                            | **GPL-3.0**        | Sealed, vented, bandpass              | No                             | No                   |
| **Scimpy**              | Measure + box (Python)  | Cross-platform       | Free                            | **GPL-3.0**        | Sealed, vented                        | No                             | **Yes** (sound card) |
| **GSpeakers**           | Box + xover             | Linux/GTK            | Free                            | **GPL** (SF)       | Box + crossover (needs SPICE)         | Yes                            | No                   |

---

## Desktop — free (the community mainstream)

### VituixCAD — the current de-facto standard

Free engineering/simulation tool for passive & active multi-way loudspeakers (up to 6-way,
4 drivers/way), with enclosure sim, response merger, crossover optimiser and directivity
analysis; imports measured FRD/ZMA. Developer **Kimmo Saunisto** (kimmosaunisto.net); was
€85 shareware before v1.0, now free, updated ~weekly (v3.0.1.4, June 2026) _(search)_.
Forum consensus calls it _"the most widely used blackbox speaker design program at the
moment … most widely tested by usage, with an active author making fixes"_, and notes it
_"calculates with the same equations as WinISD"_ for box work. **Closed source.**

### WinISD — the beginner default

Free/donationware box designer for Windows by **LinearTeam** (linearteam.org): sealed,
vented and bandpass plus a few filters; still officially beta. Forum verdict: _"super fast
and easy … pop out an enclosure sim in about 2 minutes"_ once you enter T/S params in the
right order. **Closed source** — the `ziutek/WinISD` GitHub repo is a community driver/project
collection, **not** the app source. Deepest YouTube tutorial coverage of any tool (many
beginner walkthroughs — the reason it's most newcomers' first tool).

### Hornresp — horns, TL, quarter-wave

Free 1D simulator by **David McBean** (hornresp.net): horns, transmission lines, ¼- and
½-wave resonators, bandpass and direct-radiator. Originally Fortran (1970s), now updated
roughly monthly. The go-to when lumped-element box models don't fit. **Closed source.**

### Others

- **Basta!** (Tolvan Data) — free box + crossover sim.
- **Boxsim** (Visaton, visaton.de) — free full-system sim, up to 20 drivers, baffle
  diffraction + 20-direction polar/directivity; Visaton-oriented. Closed.
- **XSim** (Bill Waslo) — free "draw-the-schematic" crossover designer; common WinISD
  companion.
- **Speaker Workshop** (Audua) — free measurement + design + crossover; old but still used;
  SourceForge presence.
- **Akabak 3** (R&D-Team, randteam.de) — free edition (b102) of an advanced electroacoustic
  network simulator; steeper than Hornresp.
- **Unibox** (Kristian Ougaard) — free (non-commercial) **Excel** model for sealed, vented,
  **passive-radiator** and bandpass boxes — one of the few free tools with PR.
- **Jeff Bagby's spreadsheets** — free Excel _Response Modeler_ and _Passive Crossover
  Designer_; long-standing community staples.

---

## Desktop — commercial

- **BassBox Pro 6** (Harris Technologies, ht-audio.com) — ~**$140–149**; design wizard,
  driver DB, sealed/vented/BP/PR. Sibling: BassBox Lite, X-over 3 Pro.
- **LspCAD** (IJData, ijdata.com) — **$129** standard / **$495** pro; full active/passive
  system design.
- **LEAP** (LinearX) — historically the professional reference simulator; **the vendor is
  defunct**, so it survives only on existing installs.
- **ARTA / STEPS / LIMP** (ARTALABS, artalabs.hr) — **~$99–187**, freemium (limited free
  mode); the popular affordable **measurement** suite.

---

## Measurement (adjacent, feeds the sims)

- **REW – Room EQ Wizard** (John Mulcahy, roomeqwizard.com) — free, cross-platform (Java);
  measures rooms, speakers, subs and devices; the most widely used free measurement tool.
  Closed source. Pro upgrade adds multi-input RMS averaging etc.
- **ARTA** (above), **LMS/CLIO** (commercial, hardware-tied).

---

## Web / browser tools

| Tool                                                                                | Enclosure types                                              | Notes                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **SpeakerBoxLite** (speakerboxlite.com)                                             | sealed, vented, 4th/6th BP, PR, TL                           | Bootstrap-Vue SPA; 300+ driver DB; "Share link/project" state sharing   |
| **Sine Design** (sinedesign.app)                                                    | sealed, ported, bandpass, PR + crossover                     | Next.js SPA; **IndexedDB** local storage; works offline; no compute API |
| **micka.de**                                                                        | sealed, vented                                               | Simple server form; already OpenISD's sealed/vented oracle              |
| **lautsprechershop.de**                                                             | sealed, vented                                               | Static page + inline JS; easy to script                                 |
| **AJ Designer / Sparked Builds / AudioGrid / the12volt / bcae1 / diyaudioandvideo** | sealed/vented/BP (varies; Sparked Builds adds PR + isobaric) | Free web calculators, no API                                            |

See the oracle report for why the PR-capable web SPAs are hard to automate.

---

## Open-source (where the code lives)

| Project                       | Repo                                      | Language | License | Stars   | Scope                                                            |
| ----------------------------- | ----------------------------------------- | -------- | ------- | ------- | ---------------------------------------------------------------- |
| **QSpeakers**                 | github.com/be1/qspeakers                  | C++/Qt   | GPL-3.0 | 54      | Sealed/vented/BP; Debian/Ubuntu packaged; OpenSCAD cut templates |
| **Scimpy**                    | github.com/maqifrnswa/scimpy              | Python   | GPL-3.0 | 72      | Impedance/SPL/GD from T/S; sound-card measurement; sealed/vented |
| **GSpeakers**                 | gspeakers.sourceforge.net                 | C++/GTK  | GPL     | (SF)    | Box + crossover; needs external SPICE                            |
| **speaker-driver-parameters** | github.com/srjh/speaker-driver-parameters | Python   | —       | (small) | Extract T/S params from a WAV                                    |
| **ziutek/WinISD**             | github.com/ziutek/WinISD                  | data     | —       | (small) | ⚠ Driver/project **data**, NOT the WinISD app source             |

Open-source box tools exist but are **niche** (tens of stars) versus the dominant closed
freeware (WinISD/VituixCAD/Hornresp). No open-source tool matches VituixCAD's breadth.
**OpenISD is unusual in being a modern, web-native, open codebase in this space.**

---

## Popularity & community consensus (evidence)

- **Where the discussion happens:** diyAudio and Parts Express "Tech Talk" are the two most
  active hubs; also AVS Forum, DIYMobileAudio, TalkBass, Audio Science Review, pink fish
  media, Free Speaker Plans.
- **Consensus hierarchy** (from the diyAudio "best software" / "comprehensive list" threads):
  VituixCAD = most powerful/most-used all-rounder; WinISD = easiest box sim for beginners;
  Hornresp = horns/TL specialist; XSim = quick crossovers. Typical DIY workflow: _"WinISD
  for box design → baffle-step correction → model the crossover in XSim."_
- **Tutorial breadth:** WinISD has by far the most YouTube beginner tutorials (many distinct
  walkthroughs exist); VituixCAD and Hornresp have active but more advanced tutorial/forum
  followings. (I cite breadth, not view counts — unverified numbers omitted.)
- **Cross-tool disagreement is a known, documented issue** — see next section.

---

## Cross-tool numerical disagreement (ties to the oracle report)

There is an active diyAudio thread, **"Inconsistent bandpass enclosure simulation in
Hornresp vs Basta, WinISD and VituixCAD"**, documenting that these four respected tools
**disagree on bandpass results**. This corroborates the oracle report's finding that even
mature tools diverge (OpenISD/micka gave `f3 ≈ 68.8 Hz` for a Butterworth sealed box while
SpeakerBoxLite read 74.5 Hz and lautsprechershop 81 Hz). Takeaway for OpenISD: **any single
external tool is a fallible oracle for bandpass/PR** — anchor those to the closed-form
Thiele/Small literature, and treat tool-vs-tool deltas as expected, not as proof of a bug.
(The bandpass thread's 403 to automated fetch means this is cited from its title/search
listing, not a full read.)

## Note on URL-state sharing

Some **browser** tools persist a session locally and/or encode it into a shareable link:
**Sine Design** uses **IndexedDB** local storage _(search)_ and **SpeakerBoxLite** exposes
explicit **"Share link" / "Share project"** actions (observed in its DOM). This is a
client-side-web pattern only. **WinISD is a Windows desktop app** — it uses `.wdr`/`.wpr`
files, **not** IndexedDB or URL-encoded state, so it does not participate in this pattern.
I have **not** reverse-engineered and will not guess any tool's URL encoding format.

---

## Relevance to OpenISD

- **Oracles:** micka (sealed/vented, wired); lautsprechershop (easy candidate); everything
  PR-capable is a hard-to-automate SPA or offline (see oracle report).
- **Feature bar to aim at:** VituixCAD (system + crossover + directivity + measurement
  import) is the target for "serious" use; WinISD is the usability bar for beginners.
- **Positioning:** OpenISD's open, web-native, modern codebase is genuinely differentiated —
  the incumbents are closed Windows freeware or niche GPL desktop apps.
- **Feature gaps worth tracking** (also in the oracle report / BACKLOG): 6th-order bandpass
  (parallel & series), transmission line, isobaric, first-class box-loss `Ql`, PR design
  helpers, crossover design, measurement import.

---

## Sources

**Forums / consensus**

- diyAudio — Best software for designing speaker enclosures: https://www.diyaudio.com/community/threads/best-software-for-designing-speaker-enclosures.431500/
- diyAudio — Comprehensive list of recommended design tools: https://www.diyaudio.com/community/threads/speaker-design-comprehensive-list-of-recommended-design-tools.324068/
- diyAudio — Inconsistent bandpass sim (Hornresp/Basta/WinISD/VituixCAD): https://www.diyaudio.com/community/threads/inconsistent-bandpass-enclosure-simulation-in-hornresp-vs-basta-winisd-and-vituixcad.379777/
- diyAudio — WinISD vs BassBox 6 Pro: https://www.diyaudio.com/community/threads/winisd-vs-bassbox-6-pro.409321/
- Parts Express Tech Talk — Modeling and Design Software recommendations: https://techtalk.parts-express.com/forum/tech-talk-forum/1428965-modeling-and-design-software-recommendations
- AVS Forum — suggestions for new speaker design software: https://www.avsforum.com/threads/i-need-suggestions-for-new-speaker-design-software.3329285/
- Audio Science Review — VituixCAD thread: https://www.audiosciencereview.com/forum/index.php?threads/has-anyone-here-used-this-vituix-software.8702/
- Link collection (DIY loudspeaker design): http://euraudio.dx.am/en/links.htm

**Tool homepages**

- WinISD / LinearTeam: https://www.linearteam.org/
- VituixCAD / Kimmo Saunisto: https://kimmosaunisto.net/
- Hornresp: http://www.hornresp.net/
- Boxsim / Visaton: https://www.visaton.de/index.php/en/downloads-boxsim
- Akabak / R&D-Team: http://www.randteam.de/AKABAK3/
- Unibox / Charlie's Audio: http://audio.claub.net/software/kougaard/ubmodel.html
- BassBox Pro (Harris Technologies): https://www.ht-audio.com/pages/Products.html · https://www.parts-express.com/BassBox-6-Pro-Software-CD-ROM-500-923
- LspCAD / IJData: https://www.ijdata.com/
- ARTA: https://artalabs.hr/
- REW – Room EQ Wizard: https://www.roomeqwizard.com/
- SpeakerBoxLite: https://speakerboxlite.com/
- Sine Design: https://sinedesign.app/
- micka.de: https://www.micka.de/en/
- lautsprechershop tools: https://www.lautsprechershop.de/tools/t_box_closed_en.htm

**Open source**

- QSpeakers: https://github.com/be1/qspeakers
- Scimpy: https://github.com/maqifrnswa/scimpy
- GSpeakers: https://gspeakers.sourceforge.net/
- speaker-driver-parameters: https://github.com/srjh/speaker-driver-parameters
- ziutek/WinISD (data only): https://github.com/ziutek/WinISD
