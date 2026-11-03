# Candidate beginner links for phone chart help (research only; checked 2026-11-03)

Verified column: "read" = fetched and text read/summarised; "status only" = HTTP 200 but page is a JS shell, text not read; "blocked" = 403/429 to bots, not verified (NOT usable as a pick until John opens it).
Rod Elliott / ESP excluded. SPL and MaxSPL keep the Eminence understanding-spl link.

| chart id | candidate url | site | page title | why it fits | verified |
|---|---|---|---|---|---|
| TFMag (TOP) | https://help.mtx.com/knowledge-base/what-do-recommended-enclosure-stats-mean | MTX Audio (mfr) | What do recommended enclosure stats mean? | Defines F3 (-3 dB point), tuning, vent dimensions in plain words; short | read |
| TFMag | https://www.soundonsound.com/techniques/what-equaliser | Sound On Sound | What Is An Equaliser? | Explains cutoff = -3 dB point | status only |
| PRTFMag (TOP) | https://www.avu.ca/audio/what-are-passive-radiators-in-speakers/ | Audio Video Unlimited (retailer) | What are Passive Radiators in Speakers? | Plain intro: PR driven by air pressure, adds bass, less woofer movement | read |
| PRTFMag | https://www.parts-express.com/what-is-a-passive-radiator | Parts Express | What is a passive radiator | Manufacturer/retailer explainer, right topic | status only (JS shell, text empty) |
| PRTFPhase (TOP) | https://www.soundonsound.com/techniques/phase-demystified | Sound On Sound | Phase Demystified | General phase explainer (audio recording slant, not speaker-specific) | status only (200, 99 mentions of phase, not read closely) |
| Phase (TOP) | https://www.prosoundweb.com/a-meaningful-loudspeaker-phase-response/ | ProSoundWeb | A Meaningful Loudspeaker Phase Response | Loudspeaker phase and time reference; WEAK: assumes measurement experience, not beginner | read (opening) |
| Phase | https://www.soundonsound.com/techniques/phase-demystified | Sound On Sound | Phase Demystified | Beginner phase; not speaker-specific | status only |
| GD (TOP) | https://audiojudgement.com/group-delay-explanation-measurement-audio/ | Audio Judgement (DIY site) | Group delay explanation and measurement (in audio) | Defines group delay, shows speaker and port GD, says >10 ms in low octaves is normal | read |
| GD | https://support.genelec.com/hc/en-us/articles/4404366195346-How-audible-is-variation-in-the-group-delay | Genelec (mfr) | How audible is variation in the group delay? | Manufacturer view on audibility | blocked (403 to curl and WebFetch); search snippet only |
| MaxPwr (TOP) | https://www.eminence.com/understanding-loudspeaker-power-ratings/ | Eminence (mfr) | Understanding Loudspeaker Power Ratings / Loudspeaker power handling | Same maker as the SPL pick; thermal limit vs mechanical (Xmax) limit | read (curl text; WebFetch 429) |
| MaxPwr | https://www.the-home-cinema-guide.com/speaker-power-rating.html | Home Cinema Guide | Speaker Power Rating: What Do RMS and Peak Power Mean? | Plain RMS vs peak power | read (title/intro) |
| VA | https://www.the-home-cinema-guide.com/speaker-power-rating.html | Home Cinema Guide | Speaker Power Rating: What Do RMS and Peak Power Mean? | Amp power vs speaker rating; does NOT cover VA/reactive load. WEAK | read |
| VA (TOP, fallback) | https://www.prosoundtraining.com/?p=2440 | Pro Sound Training | Which Impedance? Nominal / Minimum / Average | Amp is a constant-voltage source; impedance minimum is the hardest load; reactive load | read |
| Excursion (TOP) | https://www.eminence.com/understanding-loudspeaker-power-ratings/ | Eminence (mfr) | Understanding Loudspeaker Power Ratings | Defines Xmax as maximum linear excursion in simple terms | read |
| Excursion | https://audiointensity.com/pages/xmax | Audio Intensity (retailer) | What Is Xmax? Subwoofer Excursion Explained | Dedicated Xmax explainer | blocked (429); search snippet only |
| PRExcursion (TOP) | https://www.avu.ca/audio/what-are-passive-radiators-in-speakers/ | Audio Video Unlimited | What are Passive Radiators in Speakers? | PR cone moves from air pressure; lowers woofer travel | read |
| Zmag (TOP) | https://audiojudgement.com/speaker-impedance-curve-explained/ | Audio Judgement | Speaker impedance curve explained with examples | Nominal vs real impedance, resonance peak, phase angle | read |
| Zmag | https://www.prosoundtraining.com/?p=2440 | Pro Sound Training | Which Impedance? Nominal / Minimum / Average | Minimum impedance = most demanding amp load | read |
| Zph (TOP) | https://audiojudgement.com/speaker-impedance-curve-explained/ | Audio Judgement | Speaker impedance curve explained with examples | Covers phase angle and amp heating | read |
| Zph | https://audioholics.com/understanding-impedance-electrical-phase | Audioholics | Understanding Ohm's Law, Impedance And Electrical Phase 101 | Right topic, reputable | blocked (403) |
| RearPort (TOP) | https://audiojudgement.com/port-air-velocity-calculator-using-winisd/ | Audio Judgement | Port air velocity calculator - using WinISD | Port noise/chuffing, 10 m/s caution, flared ports, uses WinISD (OpenISD's clone target) | read |
| RearPort | https://subwoofer-builder.com/flare-testing.htm | Subwoofer-builder.com (DIY) | Port Flare Testing | Measured port noise vs flare and velocity | read (intro) |
| RearPortGain | none good | | | No beginner page on a port's own gain; reuse TFMag pick | none |
| FrontPort (TOP) | same as RearPort | | | | read |
| FrontPortGain | none good | | | as RearPortGain | none |
| IntraPort (TOP) | same as RearPort | | | Generic port velocity | read |
| FltMag (TOP) | https://www.soundonsound.com/sound-advice/q-what-are-filters-and-what-do-they-do | Sound On Sound | Q. What are filters and what do they do? | Slope in dB/octave, cutoff = -3 dB, worked example | read |
| FltMag | https://audiojudgement.com/passive-crossover-schematic-types/ | Audio Judgement | Passive crossover schematic - most types | Orders 6/12/18/24 dB per octave; Linkwitz-Riley vs Butterworth vs Bessel | read |
| FltPhase (TOP) | https://www.soundonsound.com/sound-advice/q-whats-difference-between-filtering-and-eq | Sound On Sound | Q. What's the difference between filtering and EQ? | Filters add frequency-dependent delay = phase shift; steeper = more | read |
| FltGD (TOP) | https://audiojudgement.com/group-delay-explanation-measurement-audio/ | Audio Judgement | Group delay explanation and measurement | Same GD explainer; no filter-specific GD page found | read |

## Gaps and cautions
- No top pick: RearPortGain, FrontPortGain (reuse TFMag/MTX F3 page or drop to no link).
- Weak picks: Phase and PRTFPhase (SOS Phase Demystified is status only, not speaker-specific; ProSoundWeb too advanced), VA (no page explains VA for speaker designers; Pro Sound Training is the nearest), TFMag (MTX page defines F3 only).
- Blocked to bots, unverified, would be good if John can open them: Genelec group delay, Audioholics impedance/phase and power ratings, Audio Intensity Xmax and ported-box pages.
- Audio Judgement is a one-person DIY blog, not a manufacturer; it supplies four picks (GD, Zmag/Zph, port velocity, crossover).
- Parts Express and Dayton: no useful beginner page found that opened as readable text.
