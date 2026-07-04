# drivers/loudspeakerdatabase

WDR files scraped from loudspeakerdatabase.com, imported 2026-06-21.

**These files are not authoritative.** They are a third-party automated import and have
known data and ParState issues documented below. Do not use them as a reference for WDR
format, ParState values, or T/S parameter accuracy without cross-checking against the
manufacturer's own datasheet.

---

## ParState issues

Every file with a ParState uses one of two fixed template strings — not genuine WinISD output:

```
EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC   (most files)
EEEEEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC   (Tang Band W5 only)
```

The template marks all T/S fields as E (user-entered) including fields WinISD would generate
as C (computed): Qts, Vd, Dd, EBP. Consequence: WinISD cannot manage those computed fields —
they are permanently pinned at the scraped value. This is a scraper design error.

10 of the 24 files have no ParState at all (short or absent string).

---

## Field value analysis (2026-06-28)

Analysis of 24 files against internal consistency checks (Qts formula, Vd = Sd x Xmax,
Dd = 2*sqrt(Sd/pi)):

**Qts vs Qms*Qes/(Qms+Qes):** all differences are small (0.0002 to 0.0044 in Q value),
consistent with the scraper transcribing a rounded 2 d.p. Qts from the datasheet while
Qms/Qes were stored at higher precision. Not a bug — just datasheet rounding.

**Vd vs Sd*Xmax:** consistent to floating-point precision in all files checked. Vd was
correctly computed by the scraper.

**Dd vs 2*sqrt(Sd/pi):** consistent within 0.0005 m in all files except one — see below.

---

## Known per-file issues

### Dayton Audio E150HE-44.wdr

Dual voice coil driver (numVC=2). Known Sd/Dd inconsistency:

| Field | Stored | Expected from formula | Difference |
|-------|--------|----------------------|------------|
| Sd    | 0.009503 m² | — (primary) | — |
| Dd    | 0.132 m | 2*sqrt(0.009503/pi) = **0.110 m** | 2.2 cm |
| Vd    | 0.0001397 m³ | Sd * Xmax = 0.009503 * 0.0147 = 0.0001397 | consistent |

Dd was sourced from a different diameter measurement than the Sd value. Vd and Xmax are
internally consistent. Do not use Dd from this file without verifying against the datasheet.

See `Dayton Audio E150HE-44_meta.yml` for the full sidecar record.

### Dayton CE67PR-4

Present only as a `.json` file — no WDR file. The scraper may have failed to produce a
WDR for this driver.

---

## Recommendation

These files may be useful as a starting point but each should be verified against the
manufacturer's datasheet before use in a serious box design. The ParState should be
regenerated correctly if any file is re-imported through the OpenISD scraper pipeline.
