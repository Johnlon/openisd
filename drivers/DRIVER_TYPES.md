# Driver type classification rules

## Categories (filter chips)

A driver carries **multiple labels** simultaneously — selecting any chip shows every
driver that carries that label.

| Chip | ID | What it covers |
|---|---|---|
| **Bass** | `bass` | Anything that handles low frequencies — sub, woofer, mid-bass, full-range |
| **Sub** | `sub` | Dedicated subwoofer (also carries `woofer` + `bass`) |
| **Woofer** | `woofer` | Low to mid-bass cone driver (also carries `bass`) |
| **Mid** | `mid` | Midrange / mid-bass — sits between woofer and tweeter |
| **Tweet** | `tweet` | High-frequency driver — dome, ribbon, planar, AMT |
| **Full-range** | `fullrange` | Single driver covering bass through treble (carries `woofer` + `mid` + `tweet` + `bass`) |
| **PR** | `pr` | Passive radiator — no voice coil, no frequency range, purely mechanical |

## Label assignment per product type

| Vendor/manufacturer calls it | Labels assigned |
|---|---|
| Subwoofer | `sub` + `woofer` + `bass` |
| Woofer | `woofer` + `bass` |
| Mid-bass / mid-woofer / midbass | `woofer` + `mid` + `bass` |
| Midrange / mid-range | `woofer` + `mid` (cone driver like a woofer, but no bass, no tweet) |
| Full-range / fullrange | `woofer` + `mid` + `tweet` + `bass` + `fullrange` |
| BMR / balanced mode radiator | `mid` + `tweet` (**not** bass — needs a separate woofer for LF) |
| Tweeter / dome / ribbon / planar / AMT / air motion | `tweet` |
| Passive radiator | `pr` |

## Classification priority

1. **PR keyword** → `['pr']` and stop (orthogonal to all frequency categories)
2. **Name-based detection** (manufacturer's own label — most reliable):
   - Tweeter/dome/ribbon/planar/AMT → `tweet`
   - Subwoofer/sub → `sub` + `woofer` + `bass`
   - Mid-bass/mid-woofer/midbass → `woofer` + `mid` + `bass`
   - Woofer (without mid-bass qualifier) → `woofer` + `bass`
   - Midrange/mid-range → `woofer` + `mid` (cone driver; not bass, not tweet)
   - Full-range/fullrange → `woofer` + `mid` + `tweet` + `bass` + `fullrange`
   - BMR/balanced mode → `mid` + `tweet`
3. **T/S parameter fallbacks** (for drivers with non-descriptive model numbers):
   - Sd < 12 cm² → `['tweet']`
   - Fs < 40 Hz → `['sub', 'woofer', 'bass']`
   - Everything else → `['woofer', 'bass']` (safe default — most unknowns are woofers)

## Venn relationships (verified against sources)

```
LOW FREQ ◄──────────────────────────────────────────────────► HIGH FREQ
          20Hz        200Hz        2kHz       10kHz      20kHz+

BASS     ████████████████████████████████████░░░░░░░░░░░░░░░░
          (everything that handles LF)

SUB      ████████████▓░░                                       ⊂ woofer ⊂ bass
WOOFER   ████████████████████████░░░░                          ⊂ bass
MID-BASS        ████████████████████░░░░                       ⊂ woofer+mid+bass
MIDRANGE              ░░░████████████████░░░                   overlap zone
TWEETER                        ░░░██████████████████           (AMT, dome, ribbon, planar)
FULL-RANGE    ░░░█████████████████████████████████████         = woofer+mid+tweet+bass
BMR                    ░░░█████████████████████               = mid+tweet (NOT bass)
PR       ◯ orthogonal — no frequency range
```

**Key relationships (verified 2026-06-25):**
- Sub IS-A woofer (a woofer optimised for very low frequencies only)
- Mid-bass IS-A woofer AND IS-A mid (sits in both ranges)
- Midrange IS a woofer (same cone construction) but NOT bass (no LF extension) and NOT tweet
- Full-range covers woofer + mid + tweet
- BMR = mid + tweet only — Tectonic (BMR inventor) sells separate woofers for bass
- AMT = a type of tweeter (Air Motion Transformer, can cross as low as 650 Hz)

## Sources

- Parts Express categories: [Hi-Fi Woofers, Subwoofers, Midranges & Tweeters](https://www.parts-express.com/speaker-components/hi-fi-woofers-subwoofers-midranges-tweeters)
- SoundImports categories: [Woofers](https://www.soundimports.eu/en/audio-components/woofers/) · [Subwoofers](https://www.soundimports.eu/en/audio-components/woofers/subwoofer/) · [Mid-Range Woofers](https://www.soundimports.eu/en/audio-components/woofers/mid-range-woofer/)
- Cambridge Audio BMR: [What is BMR?](https://www.cambridgeaudio.com/usa/en/blog/what-is-bmr)
- Tectonic BMR (inventor): [BMR Speakers](https://www.tectonicaudiolabs.com/audio-components/bmr-speakers/) — confirms separate woofer needed for bass
- Wikipedia AMT: [Air Motion Transformer](https://en.wikipedia.org/wiki/Air_Motion_Transformer)
- howtogeek.com: [What Are Woofers, Mid-Range Speakers, and Tweeters?](https://www.howtogeek.com/354985/what-are-woofers-mid-range-speakers-and-tweeters/)
- mynewmicrophone.com: [Differences Between Mid-Range Speakers, Tweeters & Woofers](https://mynewmicrophone.com/differences-between-mid-range-speakers-tweeters-woofers/)
