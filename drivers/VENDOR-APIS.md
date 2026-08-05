# Loudspeaker vendor APIs

Vendors investigated for NetSuite SuiteCommerce Advanced (SCA) API support.
The SCA API pattern returns T/S parameters as JSON:

```
GET https://www.{vendor}/api/items?q={part_number}&fieldset=details
```

A JSON response with an `"items"` array confirms NetSuite SCA.
T/S fields appear as `custitem_*` keys (see REFERENCES.md §4 for field map).

## Google site-search / bulk indexing strategy

Most vendor and database sites have no API, but their product pages are indexed by
Google (and Bing, DuckDuckGo). Two uses:

### 1. Single-driver lookup

Search Google for a specific model across all known sites:

```
site:loudspeakerdatabase.com DS115-8
site:visaton.de W170
```

Returns direct product page URLs with T/S parameter tables.
Works from any browser; can be automated via Google Custom Search API or SerpAPI.

### 2. Bulk harvest — enumerate all product pages

To get a full list of driver pages from a site, query Google for pages that
contain T/S parameter keywords:

```
site:loudspeakerdatabase.com "Qts" "Fs" "Vas"
site:visaton.de "Qts" "Fs" "Vas"
site:hificollective.co.uk "Qts" "Fs"
site:falcon-acoustics.co.uk "Qts"
site:soundimports.eu "Thiele Small"
```

Google returns paginated results (up to ~100 pages × 10 results = ~1000 URLs per
query). Scrape each linked page for T/S values.

### Sites likely to yield T/S parameters this way

Any site that publishes spec sheets or detailed product listings:

- loudspeakerdatabase.com (structured per-driver pages, best quality)
- visaton.de (manufacturer, datasheets in HTML)
- hificollective.co.uk
- falcon-acoustics.co.uk
- soundimports.eu
- scan-speak.dk, seas.no (manufacturer spec pages)
- intertechnik.de
- meniscusaudio.com
- madisound.com

### 3. Manufacturer product pages + PDF datasheets

Google can find manufacturer product pages and PDFs directly, giving Tier 2
provenance (datasheet > reseller page > database):

```
seas H1396-08 datasheet filetype:pdf
scan-speak 18W/8545 datasheet filetype:pdf
site:seas.no "H1396" datasheet
site:scan-speak.dk "18W/8545"
site:dayton-audio.com "DS115-8" specifications
```

From a manufacturer product page or PDF you can extract:

- **T/S parameters → WDR file** (authoritative values, not reseller copies)
- **PDF URL → `Comment` field in the WDR** (provenance link, e.g.
  `Comment=Datasheet: https://www.seas.no/...H1396_08.pdf`)
- **The PDF file itself** → store in `drivers/{brand}/datasheets/` for offline
  reference and future re-parsing

This is higher quality than any database because it comes from the manufacturer.
Useful manufacturers with good public datasheet libraries:

- seas.no (SEAS Excel, Prestige, Classic)
- scan-speak.dk (Revelator, Illuminator, Discovery)
- dayton-audio.com (RS, DC, SD series)
- visaton.de (W, WS series)
- peerless-by-tymphany.com / tymphany.com
- tang-band.com.tw (W series)
- eminence.com (woofers, subwoofers)
- morel.co.il (MW, CAW, TiW, TSCW)

### 4. Sitemaps — enumerate product pages without Google

Most e-commerce sites publish a sitemap that lists every URL. This is often the
fastest way to get a complete list of product pages to scrape, with no rate-limit
concerns.

Common patterns:

- `/sitemap.xml` — root sitemap (may be an index pointing to sub-sitemaps)
- `/sitemap_index.xml` — index of multiple sitemaps (products, categories, etc.)
- `/en/sitemap.xml` — localised sitemap (e.g. soundimports.eu)

Workflow: fetch the sitemap XML → filter URLs containing `/speaker`, `/woofer`,
`/driver`, `/subwoofer`, or brand names → scrape each page for T/S parameters.
Much more reliable than Google pagination for bulk harvest.

**Verified accessible sitemaps (checked 2026-06-24):**

| Vendor           | Sitemap URL                                 | Type  | Notes                                                         |
|------------------|---------------------------------------------|-------|---------------------------------------------------------------|
| SoundImports     | https://www.soundimports.eu/en/sitemap.xml  | flat  | ~1,500+ URLs; products, brands, categories                    |
| Meniscus Audio   | https://www.meniscusaudio.com/sitemap.xml   | index | 16 sub-sitemaps; WooCommerce                                  |
| DIY Sound Group  | https://www.diysoundgroup.com/sitemap.xml   | flat  | 446 URLs                                                      |
| Intertechnik     | https://www.intertechnik.de/sitemap.xml     | index | 3 sub-sitemaps (pages, blog, catalogs)                        |
| Scan-Speak       | https://www.scan-speak.dk/sitemap.xml       | index | 7 sub-sitemaps; WooCommerce — manufacturer, authoritative T/S |
| Dayton Audio     | https://www.dayton-audio.com/sitemap.xml    | index | 5 sub-sitemaps; Shopify — manufacturer, authoritative T/S     |
| Lautsprechershop | https://www.lautsprechershop.de/sitemap.xml | ⚠️    | 429 rate-limited; likely exists, retry with delay             |
| Willys HiFi      | https://www.willys-hifi.com/sitemap.xml     | ⚠️    | willyshifi.co.uk redirects here; untested                     |
| Parts Express    | https://www.parts-express.com/sitemap.xml   | ⚠️    | Empty response (bot-blocked); use API instead                 |

### Caution

- Google rate-limits scraping; use SerpAPI or Bing Search API for bulk work.
- Page layouts change; a parser written for one site will break eventually.
- PDFs require a PDF-to-text step (pdftotext, pdfplumber, or LLM extraction).
- Prefer manufacturer datasheets (Tier 2 provenance) over reseller pages.

---

## Status key

- ✅ NetSuite SCA confirmed — T/S fields present
- ⚠️ NetSuite SCA confirmed — no T/S fields
- ❌ Not NetSuite SCA (HTML / 404 / other platform)
- ❓ Untested

---

## USA vendors

| Vendor                | URL                     | SCA API | Sitemap           | Notes                                  |
|-----------------------|-------------------------|---------|-------------------|----------------------------------------|
| Parts Express         | parts-express.com       | ✅       | ⚠️ bot-blocked    | Full T/S field map in REFERENCES.md    |
| Madisound             | madisound.com           | ❌       | ❌                 | Redirects to madisoundspeakerstore.com |
| Meniscus Audio        | meniscusaudio.com       | ❌       | ✅ 16 sub-sitemaps | WooCommerce                            |
| Solen                 | solen.ca                | ❌       | ❓                 | Canada                                 |
| Woofer Source         | woofersource.com        | ❌       | ❌                 | ECONNREFUSED                           |
| Simply Speakers       | simplyspeakers.com      | ❌       | ❌                 | 403 Forbidden                          |
| Acoustic Sound Design | acousticsounddesign.com | ❌       | ❓                 |                                        |
| US Speaker            | usspeaker.com           | ❌       | ❌                 | 404                                    |
| The Loudspeaker Kit   | theloudspeakerkit.com   | ❌       | ❓                 |                                        |
| Speaker City          | speakercity.com         | ❌       | ❓                 |                                        |
| DIY Sound Group       | diysoundgroup.com       | ❌       | ✅ 446 URLs        |                                        |

---

## European vendors

| Vendor             | URL                    | SCA API | Sitemap                 | Notes                                                                                                 |
|--------------------|------------------------|---------|-------------------------|-------------------------------------------------------------------------------------------------------|
| Audiophonics       | audiophonics.fr        | ⚠️ 401  | ❌                       | France; API may be locked; worth retrying                                                             |
| HiFi Collective    | hificollective.co.uk   | ❌       | ❌                       | UK                                                                                                    |
| Willys HiFi        | willyshifi.co.uk       | ❌       | ⚠️ untested             | UK; redirects to willys-hifi.com                                                                      |
| Falcon Acoustics   | falcon-acoustics.co.uk | ❌       | ❌                       | UK; connection closed                                                                                 |
| SoundImports       | soundimports.eu        | ❌       | ✅ ~1,500 URLs           | Netherlands; best EU sitemap                                                                          |
| Intertechnik       | intertechnik.de        | ❌       | ✅ 3 sub-sitemaps        | Germany; pages/blog/catalogs                                                                          |
| Lautsprechershop   | lautsprechershop.de    | ❌       | ⚠️ rate-limited         | Germany; sitemap likely exists                                                                        |
| Visaton            | visaton.de             | ❌       | ❌                       | Germany (manufacturer)                                                                                |
| Monacor            | monacor.de             | ❌       | ❌                       | Germany                                                                                               |
| Acoustic Dimension | acoustic-dimension.com | ❌       | ❓                       |                                                                                                       |
| Tymphany           | tymphany.com           | ❌       | ❌                       | Denmark (manufacturer); 403                                                                           |
| SEAS               | seas.no                | ❌       | ❌                       | Norway (manufacturer); SSL error                                                                      |
| Scan-Speak         | scan-speak.dk          | ❌       | ✅ 7 sub-sitemaps        | Denmark (manufacturer); WooCommerce; authoritative T/S                                                |
| Dayton Audio       | dayton-audio.com       | ❓       | ✅ 5 sub-sitemaps        | Manufacturer; Shopify; authoritative T/S                                                              |
| Wavecor            | wavecor.com            | ❌       | ✅ ~150 URLs             | Manufacturer; custom static HTML; T/S in HTML pages + PDF datasheets downloadable; see §Wavecor below |
| AudioXpress        | audioxpress.com        | ❓       | ❓                       |                                                                                                       |
| SB Acoustics       | sbacoustics.com        | ❌       | ✅ ~280 product URLs     | WooCommerce; see §SB Acoustics below                                                                  |
| Accuton            | accuton.com            | ❌       | ✅ flat ~127 URLs        | Custom; ceramic/diamond/sandwich drivers; scrape directly                                             |
| Volt Loudspeakers  | voltloudspeakers.co.uk | ❌       | ✅ index, 7 sub-sitemaps | UK; WordPress                                                                                         |
| Eminence           | eminence.com           | ❌       | ✅ index, 5 sub-sitemaps | Shopify; SSL cert issue on direct fetch                                                               |
| Audio Technology   | audiotechnology.dk     | ❌       | ❌                       | Danish high-end; no sitemap                                                                           |
| Faital Pro         | faitalpro.com          | ❌       | ❌                       | Italian pro-audio; no sitemap                                                                         |
| HiVi Audio         | hiviaudio.com          | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| Fountek            | fountek.net            | ❌       | ⚠️                      | Sitemap index → 1 URL only; useless                                                                   |
| Usher Audio        | usher-audio.com        | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| Morel              | morel.co.il            | ❌       | ❌                       | SSL error                                                                                             |
| Tang Band          | tang-band.com.tw       | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| B&C Speakers       | bcspeakers.com         | ❌       | ❌                       | dinamocloud CMS; no sitemap                                                                           |
| 18 Sound           | eighteensound.com      | ❌       | ❌                       | TLS cert error on www; try http://                                                                    |
| LaVoce Audio       | lavoce-audio.com       | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| Beyma              | beyma.com              | ❌       | ✅ flat 8 URLs           | Only nav pages; has 13MB PDF catalogue — download directly                                            |
| Celestion          | celestion.com          | ❌       | ❌                       | 404                                                                                                   |
| RCF                | rcf.it                 | ❌       | ✅ flat ~200 URLs        | Liferay CMS; multi-language; per-product URLs likely; worth checking for T/S in HTML                  |
| SICA               | sica.it                | ❌       | ❌                       | 404                                                                                                   |
| Ciare              | ciare.com              | ❌       | ❌                       | Custom CMS; no sitemap                                                                                |
| Selenium           | selenium.com.br        | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| Oberton            | oberton.de             | ❌       | ❌                       | ECONNREFUSED                                                                                          |
| Radian Audio       | radianaudio.com        | ❌       | ✅ index, 5 sub-sitemaps | Shopify; pro compression drivers + woofers; check product pages for T/S                               |
| CSS Audio          | css-audio.com          | ❌       | ✅ index, 5 sub-sitemaps | Wix; only 4 products — kit speaker company, not useful                                                |
| Exodus Audio       | exodusaudio.com        | ❌       | ❌                       | HTTP 440                                                                                              |
| Precision Devices  | precisiondevices.in    | ❌       | ❌                       | ECONNREFUSED                                                                                          |

---

## SB Acoustics — detailed notes

Sitemap index: `https://sbacoustics.com/sitemap.xml`

Sub-sitemaps:
```
https://sbacoustics.com/post-sitemap.xml
https://sbacoustics.com/page-sitemap.xml
https://sbacoustics.com/product-sitemap.xml       ← ~280 product URLs
https://sbacoustics.com/category-sitemap.xml
https://sbacoustics.com/product_cat-sitemap.xml   ← 11 category URLs
```

Product URL pattern: `https://sbacoustics.com/product/{slug}/`

Examples:
```
https://sbacoustics.com/product/8in-sb23nrxs45-8-norex/
https://sbacoustics.com/product/8in-sb23mfcl45-8/
```

Product category URLs (filter by driver type):
```
https://sbacoustics.com/product-category/drivers/woofers/
https://sbacoustics.com/product-category/drivers/midwoofers/
https://sbacoustics.com/product-category/drivers/midranges/
https://sbacoustics.com/product-category/drivers/tweeters/
https://sbacoustics.com/product-category/drivers/subwoofers/
https://sbacoustics.com/product-category/drivers/passive-radiators/
```

T/S params expected in WooCommerce product HTML. ~280 pages to scrape.

---

## Wavecor — detailed notes

Sitemap: `http://www.wavecor.com/sitemap.xml` (~150 URLs)

### T/S parameters — HTML product pages (scrapeable, no PDF parsing needed)

Pattern: `http://www.wavecor.com/html/{model_lowercase}.html`

Examples (verified):

```
http://www.wavecor.com/html/wf146wa01_02.html
http://www.wavecor.com/html/wf182bd03_04.html
```

T/S parameters (Fs, Qts, Vas, Re, Le, Sd, etc.) are embedded directly in the HTML
table — easiest extraction path.

### PDF datasheets (verified ✅ ~468 KB each)

Pattern: `https://www.wavecor.com/Driver%20specifications%20PDF/{MODEL}_specifications.pdf`

Examples (verified):

```
https://www.wavecor.com/Driver%20specifications%20PDF/WF165TU01_specifications.pdf
https://www.wavecor.com/Driver%20specifications%20PDF/WF146WA01_02_specifications.pdf
https://www.wavecor.com/Driver%20specifications%20PDF/MR120BD01_02_03_04%20specifications.pdf
```

Single models: `{MODEL}_specifications.pdf`
Multi-variant: `{MODEL1}_{MODEL2}_specifications.pdf` or `{MODEL1}_{MODEL2}_{MODEL3}_{MODEL4}%20specifications.pdf`
Use PDF URL as `Comment=` provenance field in WDR.

### Outline drawing PDFs

Pattern: `https://www.wavecor.com/{MODEL}_outline_drawing_PDF.pdf`

Example:

```
https://www.wavecor.com/WF146WA01_02_outline_drawing_PDF.pdf
```

### SPL / impedance measurement TXT files (verified ✅)

Pattern: directory uses `%20` for spaces; filename uses underscores.

```
https://www.wavecor.com/Driver%20measurements%20TXT/SPL%20response/{MODEL}_SPL_response.txt
https://www.wavecor.com/Driver%20measurements%20TXT/Impedance%20response/{MODEL}_impedance_response.txt
```

Examples (verified):

```
https://www.wavecor.com/Driver%20measurements%20TXT/SPL%20response/WF165CU01_SPL_response.txt
https://www.wavecor.com/Driver%20measurements%20TXT/Impedance%20response/WF165CU01_impedance_response.txt
```

The sitemap entries use `%20` throughout (including filename) — those are wrong.
The working URLs use `_` in the filename. The earlier 404s were caused by this mismatch.
