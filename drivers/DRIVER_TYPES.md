# Driver type classification rules

> **In-app:** The `?` button in the driver browser chip row shows a popup that
> mirrors the mapping table below. **Keep both in sync** — the popup is in
> `src/components/DriverBrowser.vue` inside the `<!-- Help popup -->` comment block.

## Categories (filter chips)

A driver carries **multiple labels** simultaneously — selecting any chip shows every
driver that carries that label.

| Chip             | ID             | What it covers                                                                                   |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| **Bass**         | `bass`         | Anything that handles low frequencies — sub, woofer, mid-bass, full-range                        |
| **Sub**          | `sub`          | Dedicated subwoofer (also carries `woofer` + `bass`)                                             |
| **Woofer**       | `woofer`       | Low to mid-bass cone driver (also carries `bass`)                                                |
| **Mid**          | `mid`          | Midrange / mid-bass — sits between woofer and tweeter                                            |
| **Tweet**        | `tweet`        | High-frequency driver — dome, ribbon, planar, AMT                                                |
| **Full-range**   | `fullrange`    | Single driver covering bass through treble (carries `woofer` + `mid` + `tweet` + `bass`)         |
| **PR**           | `pr`           | Passive radiator — no voice coil, no frequency range, purely mechanical                          |
| **Coaxial**      | `coax`         | Coaxial — woofer and tweeter sharing the same axis (carries `woofer` + `bass` + `mid` + `tweet`) |
| **Unclassified** | `unclassified` | Drivers that did not match any type pattern                                                      |

## Label assignment per product type

| Vendor/manufacturer calls it                                       | Canonical name (displayed) | Labels assigned                                                |
| ------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------- |
| Subwoofer                                                          | `Subwoofer`                | `sub` + `woofer` + `bass`                                      |
| Woofer                                                             | `Woofer`                   | `woofer` + `bass`                                              |
| Mid-bass / mid-woofer / midbass / midwoofer (Scan-Speak term)      | `Mid-bass`                 | `woofer` + `mid` + `bass`                                      |
| Midrange / mid-range                                               | `Midrange`                 | `woofer` + `mid` (cone driver; no bass, no tweet)              |
| Full-range / fullrange                                             | `Full-range`               | `woofer` + `mid` + `tweet` + `bass` + `fullrange`              |
| BMR / balanced mode radiator                                       | `BMR`                      | `mid` + `tweet` (NOT bass — needs separate woofer for LF)      |
| Tweeter                                                            | `Tweeter`                  | `tweet`                                                        |
| Dome tweeter                                                       | `Tweeter`                  | `tweet`                                                        |
| Ribbon tweeter                                                     | `Ribbon Tweeter`           | `tweet`                                                        |
| Planar                                                             | `Planar Tweeter`           | `tweet`                                                        |
| AMT / air motion transformer                                       | `AMT`                      | `tweet`                                                        |
| Passive radiator                                                   | `Passive Radiator`         | `pr`                                                           |
| Coaxial / coax                                                     | `Coaxial`                  | `coax` + `woofer` + `bass` + `mid` + `tweet`                   |
| _(no type keyword — piston is tweeter-sized, Sd < 12 cm²)_         | `Tweeter`                  | `tweet`                                                        |
| _(no type keyword — resonance below 40 Hz, only subs go that low)_ | `Subwoofer`                | `sub` + `woofer` + `bass`                                      |
| _(no type keyword and no distinctive params)_                      | `Unclassified`             | _(none — appears in all filtered queries so the user notices)_ |

## Classification priority

0. **Manufacturer navigation / breadcrumb category — MOST authoritative, above name
   parsing.** Where a driver is filed by the manufacturer/distributor
   ("Loudspeaker Drivers By Type / **Tweeters** / …") IS its type, and it beats any
   keyword found in the product name. Example: `ND25FW-4` sits under **Tweeters**, so
   it is a **tweeter** even though its name contains "Waveguide" (a feature, not the
   type). Use the discovery nav/category first; fall back to name parsing (step 3)
   only when no nav category is available, and alert on a nav-vs-name conflict.
   (See TODO.md "Missed signal — discovery navigation / URL".)
1. **PR keyword** → `['pr']` and stop (orthogonal to all frequency categories)
2. **Coaxial keyword** → `['coax', 'woofer', 'bass', 'mid', 'tweet']` and stop (combined driver, appears in all frequency filter chips)
3. **Name-based detection** (manufacturer's own label — most reliable):
   - Coaxial/coax → `coax` + `woofer` + `bass` + `mid` + `tweet`
   - Tweeter/dome/ribbon/planar/AMT → `tweet`
   - Subwoofer/sub → `sub` + `woofer` + `bass`
   - Mid-bass/mid-woofer/midbass → `woofer` + `mid` + `bass`
   - Woofer (without mid-bass qualifier) → `woofer` + `bass`
   - Midrange/mid-range → `woofer` + `mid` (cone driver; not bass, not tweet)
   - Full-range/fullrange → `woofer` + `mid` + `tweet` + `bass` + `fullrange`
   - BMR/balanced mode → `mid` + `tweet`
4. **T/S parameter fallbacks** (for drivers with non-descriptive model numbers):
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

## Device-type index — INCLUDED vs EXCLUDED (the master list)

Every device type we have encountered in a manufacturer/distributor catalog,
recorded here so an excluded one is never silently re-added. This is the single
source of truth for "is this a driver we model?". The INCLUDED set corresponds
1:1 to the `DriverType` enum (`winisd_tools/scrapers/scrapers/driver_type.py` +
`openisd/packages/ui/src/driverType.ts` — kept in parity by
`test_driver_type_enum_parity.py`).

### INCLUDED — modelled driver types (the `DriverType` enum)

Direct-radiating transducers with box/Thiele-Small parameters WinISD can model.

| driver_type | notes |
| --- | --- |
| `woofer` | LF cone driver |
| `subwoofer` | woofer optimised for very low frequencies |
| `mid-bass` | woofer that also covers mid (a.k.a. mid-woofer term — see AGENT NOTE in the enum) |
| `mid-woofer` | kept separate from `mid-bass` only as a conservative union — may be the same type |
| `midrange` | cone mid, no LF extension |
| `full-range` | woofer + mid + tweet in one |
| `bmr` | Balanced Mode Radiator (mid + tweet) |
| `coaxial` | cone + dome sharing an axis → carries BOTH `specs.woofer` and `specs.tweeter` |
| `tweeter` | HF dome/ribbon/planar (incl. a tweeter that has a waveguide faceplate, e.g. Dayton ND25FW) |
| `amt` | Air Motion Transformer (a type of tweeter) |
| `passive-radiator` | no motor; mechanical T/S only (Fs/Mms/Cms/Sd/Vas), no electrical params |
| `unclassified` | fallback when a driver cannot be positively typed → abort + alert |

### EXCLUDED — real products we deliberately DO NOT scrape as drivers

These EXIST in catalogs (documented so we know they're real) but are filtered out
at discovery (by manufacturer category / breadcrumb) and must NEVER become a
`driver_type`. Grounds given per row.

| device | what it is | ground for exclusion | example |
| --- | --- | --- | --- |
| **Waveguide** | a shaped cone/form mounted on the **front of a tweeter/driver** to control HF dispersion | passive accessory — no motor/voice coil/**no T/S** | Dayton H6512, H08RW, H07E, H45E ("Horns/Waveguides" category) |
| **Horn** (bare) | a bare horn/flare | passive accessory — no T/S | Dayton "Horns/Waveguides" category |
| **Compression driver** | horn-loaded HF transducer (has Re/Fs) | **not box/T-S-modellable in WinISD** (no Sd/Vas/Xmax for enclosure design); horn-loaded, niche | Dayton ND-series compression drivers |
| **Cell adapter / mounting hardware** | bracket to mount a driver | mounting hardware, not a transducer | Accuton cell-adapter (106/130/82 mm) |
| **DSP / amplifier module** | electronics | not a transducer at all | Accuton DSP192-4-111 |

Removed from the `DriverType` enum on 2026-07-17 on these grounds: `horn`,
`waveguide` (accessories), `compression` (not box-modellable). Re-adding any of
them requires overturning the ground above AND a both-repo enum edit (parity
rule) — do not put them back casually.

## Sources

- Parts Express categories: [Hi-Fi Woofers, Subwoofers, Midranges & Tweeters](https://www.parts-express.com/speaker-components/hi-fi-woofers-subwoofers-midranges-tweeters)
- SoundImports categories: [Woofers](https://www.soundimports.eu/en/audio-components/woofers/) · [Subwoofers](https://www.soundimports.eu/en/audio-components/woofers/subwoofer/) · [Mid-Range Woofers](https://www.soundimports.eu/en/audio-components/woofers/mid-range-woofer/)
- Cambridge Audio BMR: [What is BMR?](https://www.cambridgeaudio.com/usa/en/blog/what-is-bmr)
- Tectonic BMR (inventor): [BMR Speakers](https://www.tectonicaudiolabs.com/audio-components/bmr-speakers/) — confirms separate woofer needed for bass
- Wikipedia AMT: [Air Motion Transformer](https://en.wikipedia.org/wiki/Air_Motion_Transformer)
- howtogeek.com: [What Are Woofers, Mid-Range Speakers, and Tweeters?](https://www.howtogeek.com/354985/what-are-woofers-mid-range-speakers-and-tweeters/)
- mynewmicrophone.com: [Differences Between Mid-Range Speakers, Tweeters & Woofers](https://mynewmicrophone.com/differences-between-mid-range-speakers-tweeters-woofers/)
