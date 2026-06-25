#!/usr/bin/env python3
"""
Backfill boxbench_vendorpage= for Parts Express WDR files.
Fetches each PE product page and extracts the manufacturer's site link.
Emits one progress line per file, flushed immediately.
"""
import os, re, sys, time, subprocess
from urllib.parse import urlparse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PE_DIR = os.path.join(ROOT, 'drivers', 'parts-express')

SKIP_DOMAINS = {
    'www.parts-express.com', 'parts-express.com',
    'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
    'pinterest.com', 'google.com', 'bing.com', 'trustpilot.com',
    'paypal.com', 'visa.com', 'mastercard.com', 'amex.com',
    'cdn.', 'ajax.', 'jquery', 'googleapis', 'gstatic',
    'cloudflare', 'akamai', 'doubleclick', 'adnxs',
}

MANUFACTURER_KEYWORDS = [
    "manufacturer's site", "manufacturer site", "brand website",
    "visit manufacturer", "maker's site", "official site",
]

def domain(url):
    try: return urlparse(url).netloc.lower().lstrip('www.')
    except: return ''

def is_skip(url):
    d = domain(url)
    return any(s in d for s in SKIP_DOMAINS)

def get_field(text, key):
    m = re.search(r'^' + re.escape(key) + r'=(.*)$', text, re.M)
    return m.group(1).strip() if m else ''

def set_field(text, key, value):
    pattern = r'^' + re.escape(key) + r'=.*$'
    if re.search(pattern, text, re.M):
        return re.sub(pattern, f'{key}={value}', text, flags=re.M)
    insert = f'{key}={value}\n'
    m = re.search(r'^ParState=', text, re.M)
    if m:
        return text[:m.start()] + insert + text[m.start():]
    return text.rstrip('\n') + '\n' + insert

def fetch(url):
    try:
        result = subprocess.run(
            ['curl', '-sL', '--max-time', '12', '-A',
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
             url],
            capture_output=True, text=True, timeout=15
        )
        return result.stdout
    except:
        return ''

def extract_manufacturer_link(html):
    """Find the manufacturer's own website link on a PE product page."""
    # 1. Look for anchor with manufacturer-related text
    for kw in MANUFACTURER_KEYWORDS:
        m = re.search(
            r'href=["\']([^"\']+)["\'][^>]*>(?:[^<]*<[^>]+>)*[^<]*' + re.escape(kw),
            html, re.I
        )
        if not m:
            m = re.search(
                re.escape(kw) + r'[^<]*<[^>]*href=["\']([^"\']+)["\']',
                html, re.I
            )
        if m:
            url = m.group(1).strip()
            if url.startswith('http') and not is_skip(url):
                return url

    # 2. Look for JSON-LD brand url
    for jld in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S | re.I):
        brand_url = re.search(r'"brand"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"', jld)
        if brand_url:
            url = brand_url.group(1).strip()
            if url.startswith('http') and not is_skip(url):
                return url

    # 3. Look for rel="nofollow" external links near "manufacturer" text
    # PE pages often have a table row: Manufacturer | <a href="...">Visit Site</a>
    m = re.search(
        r'(?:manufacturer|brand)[^<]{0,200}href=["\']([^"\']+)["\']',
        html, re.I | re.S
    )
    if m:
        url = m.group(1).strip()
        if url.startswith('http') and not is_skip(url):
            return url

    return ''

def extract_pdf(html):
    pdfs = re.findall(r'href=["\']([^"\']*\.pdf(?:\?[^"\']*)?)["\']', html, re.I)
    pdfs = [p.strip() for p in pdfs
            if p.strip().startswith('http')
            and 'font' not in p.lower()
            and 'icomoon' not in p.lower()]
    return pdfs[0] if pdfs else ''

# ── Main ──────────────────────────────────────────────────────────────────────

wdr_files = sorted(f for f in os.listdir(PE_DIR) if f.endswith('.wdr'))
total = len(wdr_files)

updated = 0
n_vendorpage = 0
n_datasheet = 0
n_skip = 0
n_nomatch = 0
n_jsfail = 0

print(f'Processing {total} Parts Express WDR files...', flush=True)

for i, fname in enumerate(wdr_files, 1):
    fpath = os.path.join(PE_DIR, fname)
    text = open(fpath, encoding='utf-8', errors='ignore').read()

    # Skip if already fully populated
    if get_field(text, 'boxbench_vendorpage'):
        print(f'[{i}/{total}] SKIP {fname}', flush=True)
        n_skip += 1
        continue

    src = get_field(text, 'boxbench_source')
    if not src:
        print(f'[{i}/{total}] NO-SRC {fname}', flush=True)
        continue

    print(f'[{i}/{total}] fetching {fname[:60]} ...', end=' ', flush=True)

    html = fetch(src)

    if not html or len(html) < 500:
        print(f'FAIL (empty)', flush=True)
        n_jsfail += 1
        time.sleep(0.5)
        continue

    # JS-gated pages return a shell with no product content
    if 'add to cart' not in html.lower() and 'add-to-cart' not in html.lower() and \
       'part number' not in html.lower() and 'Fs' not in html:
        print(f'JS-GATED', flush=True)
        n_jsfail += 1
        time.sleep(0.3)
        continue

    vendor = extract_manufacturer_link(html)
    pdf    = extract_pdf(html)

    orig = text
    result_parts = []
    if vendor:
        text = set_field(text, 'boxbench_vendorpage', vendor)
        result_parts.append(f'vp={vendor[:50]}')
        n_vendorpage += 1
    if pdf and not get_field(text, 'boxbench_datasheet'):
        text = set_field(text, 'boxbench_datasheet', pdf)
        result_parts.append(f'ds=PDF')
        n_datasheet += 1

    if text != orig:
        open(fpath, 'w', encoding='utf-8').write(text)
        updated += 1
        print(f'OK  {" | ".join(result_parts)}', flush=True)
    else:
        print(f'NO-MATCH', flush=True)
        n_nomatch += 1

    time.sleep(0.5)

print(f'\n{"="*60}', flush=True)
print(f'Total processed : {total}', flush=True)
print(f'Updated         : {updated}', flush=True)
print(f'  vendorpage set: {n_vendorpage}', flush=True)
print(f'  datasheet set : {n_datasheet}', flush=True)
print(f'Skipped (done)  : {n_skip}', flush=True)
print(f'JS-gated/failed : {n_jsfail}', flush=True)
print(f'No match found  : {n_nomatch}', flush=True)
