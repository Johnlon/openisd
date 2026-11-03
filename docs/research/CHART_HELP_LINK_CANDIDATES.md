# Chart help links reviewed (research only, 2026-11-03)

Method: page text fetched with curl (browser user agent) and converted to text, or WebFetch. "Read in full" = yes only when the whole article text was read. Pages I could not get as text, or only partly read, are marked no and fail. Rod Elliott / sound-au.com excluded.
Eminence's server rate-limited (HTTP 429) after the first successful fetch: the SPL page was read in full; the power-ratings page was never readable.
Scores: S = simple, C = clear (explains the very thing the chart shows), Sh = short (a few minutes), Tr = trustworthy (maker or well-known audio source).

## Table 1: every link

| url | site | read in full | simple | clear | short | pass/fail | why | contradictions with OpenISD help text |
|---|---|---|---|---|---|---|---|---|
| https://eminence.com/blogs/blog/understanding-spl | Eminence (maker) | yes (about 250 words) | yes | yes for SPL; no for Max SPL | yes | PASS for SPL, FAIL for MaxSPL | Two plain paragraphs: SPL = loudness/sensitivity, measured at 1 m, drawn as frequency (Hz) vs SPL (dB). Says nothing about maximum output, power or excursion limits. | None. Minor: page speaks of sensitivity, OpenISD's SPL chart is for the power set on the Signal page. |
| https://help.mtx.com/knowledge-base/what-do-recommended-enclosure-stats-mean | MTX Audio (maker) | yes (480 words) | yes | yes for F3, Qtc, ripple, "Excursion Limited Power" and "Excursion Limited SPL" | yes | PASS (MaxSPL, MaxPwr); weak for TFMag | Glossary of enclosure terms. Defines Excursion Limited SPL and Power in one line each, and F3. | F3 is defined against the level at 100 Hz, OpenISD draws it against the passband. Minor. |
| https://www.soundonsound.com/techniques/what-equaliser | Sound On Sound | partly (first half) | yes | no (studio EQ: shelves, peaks) | no | FAIL | About mixing-desk EQ, not speaker filters. | none found |
| https://www.avu.ca/audio/what-are-passive-radiators-in-speakers/ | Audio Video Unlimited (retailer) | no (curl got HTTP 520; only a WebFetch summary) | - | - | - | FAIL | Full text not obtained. Summary says: PR has no wiring, driven by air pressure, less woofer movement; a buying-advice page. | none found |
| https://www.parts-express.com/what-is-a-passive-radiator | Parts Express | no (empty JS shell) | - | - | - | FAIL | No text readable. | - |
| https://www.soundonsound.com/techniques/phase-demystified | Sound On Sound | mostly (long lines clipped) | yes | no | no | FAIL | Mic phase cancellation and comb filtering in recording. Not loudspeaker transfer phase. About 20 min. | none found |
| https://www.prosoundweb.com/a-meaningful-loudspeaker-phase-response/ | ProSoundWeb | no (403 to curl; WebFetch gave page 1 of 7) | no | no | no | FAIL | Written for people who already measure speakers; page 1 is about impulse responses. | - |
| https://audiojudgement.com/group-delay-explanation-measurement-audio/ | Audio Judgement (one-person DIY blog) | yes (4 min read) | mostly (one derivative sentence) | yes | yes | PASS (GD) | Says what group delay is, shows box and port GD, gives values by frequency. | OpenISD GD says aim below about 15 to 20 ms at 40 Hz. Page says under 200 Hz expect higher, even 30 to 40 ms, and above 10 ms is normal for port bass. Thresholds differ. |
| https://support.genelec.com/hc/en-us/articles/4404366195346-How-audible-is-variation-in-the-group-delay | Genelec (maker) | no (403 to curl and WebFetch) | - | - | - | FAIL | Unreadable. | - |
| https://www.eminence.com/understanding-loudspeaker-power-ratings/ (also eminence.com/blogs/blog/understanding-loudspeaker-power-ratings) | Eminence (maker) | no (HTTP 429 on every try; saw only the blog index excerpt and a search summary) | - | - | - | FAIL | Could not read it, so cannot pass it. Index excerpt: free-air test with EIA 426A noise, thermal vs mechanical limit. John could open it by hand. | - |
| https://www.the-home-cinema-guide.com/speaker-power-rating.html | Home Cinema Guide | yes (first 60 lines of 2000 words, rest is buying advice) | yes | no | yes | FAIL | RMS vs peak watts for matching an amp. Not a power-vs-frequency curve, nothing on excursion limits. | none found |
| https://www.prosoundtraining.com/?p=2440 | Pro Sound Training (Pat Brown, SynAudCon) | yes | mostly | yes for Zmag (minimum impedance = the amp load) | yes | PASS (Zmag); FAIL for VA | Plain on impedance curve, nominal vs minimum, reactive load. Never defines VA or apparent power. | none found. Agrees that low minimum impedance loads the amp. |
| https://audiointensity.com/pages/xmax | Audio Intensity (retailer) | no (429 every try) | - | - | - | FAIL | Unreadable. | - |
| https://audiojudgement.com/speaker-impedance-curve-explained/ | Audio Judgement | yes (5 min) | yes | yes | yes | PASS (Zmag, Zph) | Walks the impedance and phase curves for free air, sealed, vented (two peaks, dip at Fb). | Zph: page says 0 degrees at resonance and where the rise starts, OpenISD says 0 at each peak and dip: compatible. Page claims an amp runs 4 times as hot at 45 degrees; Audioholics says 2 times. Do not repeat that figure. |
| https://audioholics.com/understanding-impedance-electrical-phase | Audioholics | yes | no (five numbered equations, power triangle) | partly | no | FAIL | Useful but equation-led, about 12 min. Credits Rod Elliott and uses a sound-au chart. | Says the amp does not see extra apparent power from phase angle. OpenISD VA help says tall VA spikes demand heavy reactive current. These disagree. |
| https://audiojudgement.com/port-air-velocity-calculator-using-winisd/ | Audio Judgement | yes (5 min) | yes | yes | yes | PASS (port velocity) with contradiction | Plain talk on chuffing, flared ends, port size, uses WinISD graph "Rear port air velocity". | CONTRADICTION: page says above 10 m/s can be noisy on a plain pipe, up to 30 m/s with both ends flared. OpenISD says below 17 m/s quiet, up to 35 m/s flared. |
| https://subwoofer-builder.com/flare-testing.htm | subwoofer-builder.com (DIY) | yes (first two thirds read, rest is test data) | no | partly | no | FAIL | Experiment write-up with area ratios and a calculator. | Says below about 10 m/s no problems. OpenISD says 17. |
| https://www.soundonsound.com/sound-advice/q-what-are-filters-and-what-do-they-do | Sound On Sound | yes (835 words) | yes | yes | yes | PASS (FltMag) | Low-pass and high-pass, dB per octave slope with a worked example (18 dB/oct at 80 Hz: 40 Hz is 18 dB down). Recording slant. | None. Candidate file said it explains "cutoff = -3 dB"; it does not. |
| https://audiojudgement.com/passive-crossover-schematic-types/ | Audio Judgement | yes | no (capacitor/inductor formulas) | partly | no (7 min) | FAIL | Circuit-building page; the order/slope list is the only relevant part. | none found |
| https://www.soundonsound.com/sound-advice/q-whats-difference-between-filtering-and-eq | Sound On Sound | yes (885 words) | yes | yes | yes | PASS (FltPhase, FltGD) | Filters add delay that varies with frequency; steeper = worse phase variation; Bessel is the closest to constant delay. | None. Backs OpenISD advice to use Bessel for less delay. |
| https://en.wikipedia.org/wiki/Thiele/Small_parameters | Wikipedia | no (text fetched, intro and equation count only; 7400 words, 168 equation blocks) | no | no | no | FAIL | Equation-heavy reference. | - |
| https://en.wikipedia.org/wiki/Loudspeaker_enclosure | Wikipedia | no (scanned) | mostly | no | no (6600 words) | FAIL | Broad survey of box types. | - |
| https://en.wikipedia.org/wiki/Bass_reflex | Wikipedia | mostly (first half read) | yes | partly | no (3400 words) | FAIL | Readable, no equations, but long and general. | None. Says transient response is worse and cone moves far below tuning: agrees. |
| https://en.wikipedia.org/wiki/Group_delay_and_phase_delay | Wikipedia | no (scanned) | no (104 equation blocks) | - | no | FAIL | Maths article. | - |
| https://en.wikipedia.org/wiki/Electrical_impedance | Wikipedia | no (scanned) | no (108 equation blocks) | - | no | FAIL | Maths article. | - |
| https://en.wikipedia.org/wiki/Bode_plot | Wikipedia | no (scanned) | no (91 equation blocks) | - | no | FAIL | Control-theory article. | - |
| https://en.wikipedia.org/wiki/Transfer_function | Wikipedia | no (scanned) | no (73 equation blocks) | - | no | FAIL | Control-theory article. | - |
| https://en.wikipedia.org/wiki/Phase_(waves) | Wikipedia | no (scanned) | no (115 equation blocks) | - | no | FAIL | Wave maths. | - |
| https://en.wikipedia.org/wiki/Butterworth_filter | Wikipedia | no (scanned) | no (149 equation blocks) | - | no | FAIL | Filter maths. | - |
| https://en.wikipedia.org/wiki/Equalization_(audio) | Wikipedia | no (scanned) | mostly | no | no (5500 words) | FAIL | About tone EQ, not box or filter charts. | - |
| https://en.wikipedia.org/wiki/Apparent_power | Wikipedia | no (scanned) | no (48 equation blocks) | - | no | FAIL | Power-engineering article. | - |
| https://en.wikipedia.org/wiki/Loudspeaker | Wikipedia | no (scanned) | mostly | no | no (13700 words) | FAIL | Whole-topic article. | - |
| https://diyaudioprojects.com/Technical/Papers/Loudspeakers-in-Vented-Boxes-Part-I.pdf | Thiele, JAES 1971 | no (scanned PDF, no text layer) | no | - | no | FAIL | 11-page maths paper. Not for beginners. | - |
| https://diyaudioprojects.com/Technical/Papers/Direct-Radiator-Loudspeaker-System-Analysis.pdf | Small, JAES 1972 | no (scanned PDF, no text layer) | no | - | no | FAIL | 13-page maths paper. | - |
| https://diyaudioprojects.com/Technical/Papers/Vented-Box-Loudspeaker-Systems-Part-I.pdf | Small, JAES 1973 | no (scanned PDF, no text layer) | no | - | no | FAIL | 10-page maths paper. | - |
| https://www.linkwitzlab.com/filters.htm | Linkwitz Lab | no (scanned, circuit-design page) | no | - | no | FAIL | Active filter circuit design. | - |
| https://www.linkwitzlab.com/frontiers.htm | Linkwitz Lab | no (scanned, 10800 words) | no | - | no | FAIL | Long personal design essay. | - |

### Found by search (new)

| url | site | read in full | simple | clear | short | pass/fail | why | contradictions with OpenISD help text |
|---|---|---|---|---|---|---|---|---|
| https://www.audioholics.com/loudspeaker-articles/sealed-vs-ported-subwoofers | Audioholics (well-known) | yes (1800 words) | yes | yes for box roll-off, excursion, group delay, port boost at tuning | mostly (about 8 min) | PASS (TFMag, GD, Excursion, RearPortGain) | Sealed rolls off 12 dB/oct, ported 24 dB/oct; ported boosts output at the vent resonance; excursion "goes off the charts" below tuning; sealed group delay stays under 15 ms. | None. Backs OpenISD's 12 and 24 dB per octave and its 15 ms figure. |
| https://www.humanspeakers.com/whatis/PR.htm | HUMAN Speakers (small maker, old page) | yes (1360 words) | yes | yes for PR | yes | PASS (PRTFMag, PRTFPhase, PRExcursion) | PR as a weight on a spring; tuned below the woofer; PR moves most and woofer least at PR resonance; phase offset; bigger, more linear PR excursion. | Says vented and PR systems roll off at 18 dB/oct and sealed at 6. OpenISD's TFMag says 24 and 12. Page uses an older third-order view. OpenISD PR help does not state a slope. |
| https://www.subwoofer-builder.com/xmax.htm | subwoofer-builder.com (well-known DIY sub site) | yes (490 words) | yes | yes | yes | PASS (Excursion) | Xmax vs Xlim with a diagram description; audible distortion past about Xmax + 10%. | None. OpenISD says stay under the Xmax line; page allows a little over for sub use. |
| https://international.mtx.com/library-speakers | MTX Audio (maker) | yes (2600 words, labelled "15 min, Advanced") | mostly | yes for thermal vs mechanical limit and Xmax | no | PASS (MaxPwr), weak: long | Only maker page that states plainly why a speaker fails mechanically at low frequency and thermally at high power, and defines Xmax. | None. Agrees power limit falls at low frequency (excursion). |
| https://www.hifireport.com/speaker-excursion-101-what-xmax-really-tells-you-about-your-bass/ | HiFiReport (affiliate blog) | yes (1200 words) | yes | yes | yes | FAIL | Bicycle-pump picture of Xmax, plain. Fails trust: affiliate blog, unknown author. | none found |
| https://theaudiostuff.com/glossary/bass-reflex/ | The Audio Stuff (review site) | yes (1500 words) | yes | partly | yes | FAIL | Plain port explainer, 24 vs 12 dB/oct. Fails trust: small review site, buying angle. | None. |
| https://eaw.com/wp-content/uploads/2020/12/Processor_Setting_Fundamentals.pdf | EAW (maker) | partly (first 3 of 14 pages) | mostly | partly (crossover phase, polarity) | no | FAIL | 14-page PA-processor paper. | - |
| https://www.humanspeakers.com / helpcenter.arendalsound.com PR article | Arendal | no (403) | - | - | - | FAIL | Unreadable. | - |
| https://audiointensity.com/blogs/how-to-build/ported-subwoofer-box-design-tuning | Audio Intensity | no (429) | - | - | - | FAIL | Unreadable. | - |

## Table 2: final pick per chart

| chart id | final pick url | page title |
|---|---|---|
| SPL | https://eminence.com/blogs/blog/understanding-spl | Understanding SPL (Eminence) |
| MaxSPL | https://help.mtx.com/knowledge-base/what-do-recommended-enclosure-stats-mean | What do recommended enclosure stats mean? (MTX); Eminence SPL page does not cover maximum SPL |
| TFMag | https://www.audioholics.com/loudspeaker-articles/sealed-vs-ported-subwoofers | Sealed vs Ported Subwoofers: Which Is Right For You? |
| PRTFMag | https://www.humanspeakers.com/whatis/PR.htm | HUMAN Speakers: What is a passive radiator? |
| PRTFPhase | https://www.humanspeakers.com/whatis/PR.htm | HUMAN Speakers: What is a passive radiator? (phase covered only in words, no number) |
| Phase | none: no simple page found | - |
| GD | https://audiojudgement.com/group-delay-explanation-measurement-audio/ | Group delay explanation and measurement (in audio); thresholds differ from OpenISD, see table 1 |
| MaxPwr | https://international.mtx.com/library-speakers | How Loudspeakers Work: Components, Parameters & Power (MTX); long. Eminence power-ratings page would be better but was unreadable (429) |
| VA | none: no simple page found | - (nearest: Pat Brown on reactive loads, but it never defines VA) |
| Excursion | https://www.subwoofer-builder.com/xmax.htm | Xmax |
| PRExcursion | https://www.humanspeakers.com/whatis/PR.htm | HUMAN Speakers: What is a passive radiator? |
| Zmag | https://audiojudgement.com/speaker-impedance-curve-explained/ | Speaker impedance curve explained with examples |
| Zph | https://audiojudgement.com/speaker-impedance-curve-explained/ | Speaker impedance curve explained with examples |
| RearPort | https://audiojudgement.com/port-air-velocity-calculator-using-winisd/ | Port air velocity calculator - using WinISD (thresholds contradict OpenISD) |
| RearPortGain | https://www.audioholics.com/loudspeaker-articles/sealed-vs-ported-subwoofers | Sealed vs Ported Subwoofers (partial: port boost at tuning, not a port-only chart) |
| FrontPort | https://audiojudgement.com/port-air-velocity-calculator-using-winisd/ | Port air velocity calculator - using WinISD (thresholds contradict OpenISD) |
| FrontPortGain | none: no simple page found | - |
| IntraPort | https://audiojudgement.com/port-air-velocity-calculator-using-winisd/ | Port air velocity calculator - using WinISD (thresholds contradict OpenISD) |
| FltMag | https://www.soundonsound.com/sound-advice/q-what-are-filters-and-what-do-they-do | Q. What are filters and what do they do? |
| FltPhase | https://www.soundonsound.com/sound-advice/q-whats-difference-between-filtering-and-eq | Q. What's the difference between filtering and EQ? |
| FltGD | https://www.soundonsound.com/sound-advice/q-whats-difference-between-filtering-and-eq | Q. What's the difference between filtering and EQ? |

## Contradictions with OpenISD help text

- Port velocity (RearPort, FrontPort, IntraPort): OpenISD says 17 m/s plain pipe, 35 m/s flared. Audio Judgement says 10 and 30. Subwoofer-builder says 10. A search found 17 m/s widely quoted; no maker page found that states 17 and 35.
- GD: OpenISD aims below 15 to 20 ms at 40 Hz. Audio Judgement says 30 to 40 ms is expected under 200 Hz. Audioholics shows sealed designs under 15 ms.
- VA: Audioholics says the amp does not need extra current for phase angle; OpenISD says VA spikes demand heavy reactive current.
- TFMag/PR: HUMAN Speakers says vented/PR roll-off is 18 dB/oct and sealed 6; OpenISD says 24 and 12 (Audioholics agrees with OpenISD).

# Remaining 9 charts (second search, 3 Nov 2026)
# Chart links, remaining nine (research only, 2026-11-03)

All pages fetched with curl (browser UA) and converted to text; each read in full. Raw text in scratchpad/p/.
Note: the Speaker Box Lite (software maker) overview page matches OpenISD help numbers exactly (17/35 m/s, 12/24 dB/oct, 180/360 deg, 15-20 ms): it is probably the origin of the help text.

## Table 1: picks

| chart id | url | site | short page title | read in full | why it passes | numbers it states |
|---|---|---|---|---|---|---|
| RearPort | https://speakerboxlite.com/articles/overview-simulation-graphs-speaker-box-lite-analyzing-speaker-performance | Speaker Box Lite (software maker) | Speaker Box Lite: Simulation graphs overview | yes (2050 words, section "Vent Air Velocity" is 1 paragraph) | Plain section on chuffing, widening port lowers speed, longer port needed. Same numbers as OpenISD. Page is long: it covers every chart; only the vent paragraph is needed | below 17 m/s clean; 17-35 moderate; over 35 very bad |
| FrontPort | same as RearPort | same | same | yes | same | same |
| IntraPort | same as RearPort | same | same | yes | same (port between chambers is still a port) | same |
| Phase | same as RearPort (section "Transfer Function Phase") | same | same | yes | Says each box shifts phase; sealed about 180 deg, ported 360 deg; look for smooth change, sharp jumps = resonance/poor transients. Matches OpenISD help | 180 deg sealed, 360 deg ported |
| PRTFMag | https://speakerboxlite.com/articles/passive-radiator-enclosures-deep-dive-into-bass-efficiency-smart-design | Speaker Box Lite | Speaker Box Lite: Passive radiator enclosures | yes (1450 words) | Plain: PR is a cone with no coil replacing the port air mass; tuned by adding mass; wrong size gives peaks or dips. No contradiction. Covers the PR in general, not "PR alone" curve as such | Sd at least 2x driver; Qts 0.25-0.45; no dB/oct, no m/s |
| PRExcursion | same as PRTFMag | same | same | yes | Says an undersized or mismatched PR reaches its excursion limit quickly; PR Sd should be 2x the driver for that reason. Alternate: Accuton "Passive Radiator Technology" (https://accuton.com/home-audio/drivers/passive-radiator/passive-radiator-technology, maker, 600 words, read in full; shows 12 mm PR vs 5 mm driver excursion; has two small equations at the end) | as above |
| VA | https://ch.yamaha.com/de/business/audio/resources/self-training/micro-tutorial/20170921 (same text on other Yamaha locales, e.g. uk.yamaha.com/en/business/audio/resources/self-training/micro-tutorial/20170921/) | Yamaha Pro Audio (maker) | Yamaha: Power amplifiers part two | yes (about 600 words) | Maker page: a speaker is inductive, so voltage and current go out of phase; the amp must give high current while voltage is small, so it works much harder and runs hot. Matches OpenISD VA help (heavy reactive current). Never says "volt-amps" | none for load; mentions 6 dB crest factor (irrelevant) |
| FrontPortGain | https://speakerboxlite.com/articles/world-speaker-enclosures-sealed-transmission-line | Speaker Box Lite | Speaker Box Lite: The world of speaker enclosures | yes (2000 words; bandpass section is 3 short paragraphs) | 4th-order bandpass: one chamber sealed, other vented; sound leaves only by the port; ported chamber boosts output, narrow band, drops off quickly outside it. Matches OpenISD "main passband of a bandpass box". No numbers | none |
| PRTFPhase | none | - | - | - | No page found that covers PR phase in plain words. The PRTFMag page could be reused only if John accepts a general PR page | - |

Weak points: Speaker Box Lite is a software vendor blog (one author). It is plain and agrees with OpenISD, but is not an independent maker of drivers. Yamaha page does not use the word volt-amps.

## Table 2: rejected

| url | site | why rejected |
|---|---|---|
| https://rythmikaudio.com/phase2.html and phase.html | Rythmik (maker) | Read in full. About matching sub phase to speakers at crossover. Not about the transfer phase curve of one box. Says vented has "considerably more phase shift", no numbers |
| https://www.trueaudio.com/about_3.htm | True Audio | Read; long, general site page, not about box phase |
| https://speakerboxlite.com/articles/port-area-calculation-guide-speaker-box-lite-workflow | Speaker Box Lite | Read in full. Port-area workflow with software; gives 17 and 26 m/s (26 contradicts OpenISD 35). Overview page above is better |
| https://audiojudgement.com/how-to-tune-passive-radiator/ | Audio Judgement | Read in full. WinISD step-by-step tutorial, not a chart explainer; not simple |
| https://electromarket.co.uk/guide/speakers/what-is-impedance-in-speakers | ElectroMarket (retailer) | Read in full. Ohms and matching only; nothing on reactive load or VA |
| https://audiointensity.com/blogs/car-subwoofer-enclosures/bandpass-box-low-frequencies | Audio Intensity | HTTP 429, unreadable |
| https://audioholics.com/understanding-impedance-electrical-phase | Audioholics | Already rejected (equations; says amp does not see extra apparent power; contradicts VA help) |
| https://sound-au.com/patd.htm | Elliott Sound Products | Banned source |
| forum threads (caraudio.com, diyaudio, audioholics forum, htguide) | forums | Unreliable, anonymous posts |
| https://www.prosoundtraining.com/site/wp-content/uploads/2010/02/nl052_why_fuss_about_power.pdf | Pro Sound Training | Fetched but not read in full; not used |
