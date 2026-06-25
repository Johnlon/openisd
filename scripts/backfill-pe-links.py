#!/usr/bin/env python3
"""
Backfill boxbench_vendorpage= and boxbench_datasheet= for Parts Express WDR files.
Pass 1: fetch PE product page → manufacturer homepage (vendorpage) + any PDF
Pass 2: fetch manufacturer's own site with model query → find PDF (datasheet)
Runs in parallel; emits one progress line per file.
Usage: python scripts/backfill-pe-links.py [--workers N] [--pass {1,2,both}]
"""
import os, re, sys, time, subprocess, threading, argparse, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, urlencode, urljoin

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PE_DIR = os.path.join(ROOT, 'drivers', 'parts-express')

SKIP_DOMAINS = {
    'parts-express.com', 'partsexpress.com',
    'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
    'pinterest.com', 'google.com', 'bing.com', 'trustpilot.com',
    'paypal.com', 'visa.com', 'mastercard.com',
    'cloudflare.com', 'akamai.com', 'doubleclick.net', 'adnxs.com',
    'vwo.com', 'schema.org', 'dmws.nl', 'webshopapp.com',
}

MANUFACTURER_KEYWORDS = [
    "manufacturer's site", "manufacturer site", "brand website",
    "visit manufacturer", "maker's site", "official site",
]

# Brand → search URL template for finding product PDFs on manufacturer sites
# %s is replaced with the model number
BRAND_SEARCH = {
    'dayton audio':   'https://www.daytonaudio.com/index.php?route=product/search&search=%s',
    'eminence':       'https://www.eminence.com/speakers/?s=%s',
    'peerless':       'https://www.tymphany.com/search/?q=%s',
    'seas':           'https://www.seas.no/index.php?option=com_content&task=search&searchword=%s',
    'scanspeak':      'https://www.scanspeak.dk/Search?q=%s',
    'wavecor':        'https://www.wavecor.com/Search.aspx?q=%s',
    'tang band':      'https://www.tb-speaker.com/search?keyword=%s',
    'sb acoustics':   'https://sbacoustics.com/?s=%s',
    'faital pro':     'https://www.faitalpro.com/en/search/?q=%s',
    'b&c':            'https://www.bcspeakers.com/search?q=%s',
    'fountek':        'https://www.fountek.net/products/?q=%s',
    'lavoce':         'https://www.lavoce-usa.com/?s=%s',
    'ciare':          'https://www.ciare.com/?s=%s',
    'beyma':          'https://www.beyma.com/search?q=%s',
    'hivi':           'https://www.hiviusa.com/search?type=product&q=%s',
    'morel':          'https://www.morelhifi.com/search?q=%s',
    'celestion':      'https://celestion.com/search/?q=%s',
    'goldwood':       'https://www.goldwoodsound.com/search?q=%s',
}

print_lock = threading.Lock()

def pprint(*args):
    with print_lock:
        print(*args, flush=True)

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
    return (text[:m.start()] + insert + text[m.start():]) if m else (text.rstrip('\n') + '\n' + insert)

def fetch(url):
    try:
        r = subprocess.run(
            ['curl', '-sL', '--max-time', '12', '-A',
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
             url],
            capture_output=True, timeout=15
        )
        return r.stdout.decode('utf-8', errors='replace')
    except:
        return ''

def extract_manufacturer_link(html):
    for kw in MANUFACTURER_KEYWORDS:
        m = re.search(r'href=["\']([^"\']+)["\'][^>]*>(?:[^<]*<[^>]+>)*[^<]*' + re.escape(kw), html, re.I)
        if not m:
            m = re.search(re.escape(kw) + r'[^<]*<[^>]*href=["\']([^"\']+)["\']', html, re.I)
        if m:
            url = m.group(1).strip()
            if url.startswith('http') and not is_skip(url):
                return url
    for jld in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S | re.I):
        bm = re.search(r'"brand"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"', jld)
        if bm:
            url = bm.group(1).strip()
            if url.startswith('http') and not is_skip(url):
                return url
    m = re.search(r'(?:manufacturer|brand)[^<]{0,200}href=["\']([^"\']+)["\']', html, re.I | re.S)
    if m:
        url = m.group(1).strip()
        if url.startswith('http') and not is_skip(url):
            return url
    return ''

def extract_pdf(html, base_url=''):
    pdfs = []
    for p in re.findall(r'href=["\']([^"\']*\.pdf(?:\?[^"\']*)?)["\']', html, re.I):
        p = p.strip()
        if not p.startswith('http') and base_url:
            p = urljoin(base_url, p)
        if p.startswith('http') and 'font' not in p.lower() and 'icomoon' not in p.lower():
            pdfs.append(p)
    return pdfs[0] if pdfs else ''

# ── Pass 1: fetch PE product page ─────────────────────────────────────────────

def pass1(i, total, fname):
    fpath = os.path.join(PE_DIR, fname)
    text = open(fpath, encoding='utf-8', errors='ignore').read()

    if get_field(text, 'boxbench_vendorpage'):
        pprint(f'[{i}/{total}] SKIP  {fname}')
        return

    src = get_field(text, 'boxbench_source')
    if not src:
        pprint(f'[{i}/{total}] NO-SRC {fname}')
        return

    pprint(f'[{i}/{total}] fetch {fname[:70]}')
    html = fetch(src)

    if not html or len(html) < 500:
        pprint(f'[{i}/{total}] FAIL  (empty)')
        return

    if ('add to cart' not in html.lower() and 'add-to-cart' not in html.lower()
            and 'part number' not in html.lower()):
        pprint(f'[{i}/{total}] JS-GATED')
        return

    vendor = extract_manufacturer_link(html)
    pdf    = extract_pdf(html, src)

    orig = text
    tags = []
    if vendor:
        text = set_field(text, 'boxbench_vendorpage', vendor)
        tags.append(f'vp={vendor[:50]}')
    if pdf and not get_field(text, 'boxbench_datasheet'):
        text = set_field(text, 'boxbench_datasheet', pdf)
        tags.append('ds=PDF')
    if text != orig:
        open(fpath, 'w', encoding='utf-8').write(text)
        pprint(f'[{i}/{total}] OK  {" | ".join(tags)}')
    else:
        pprint(f'[{i}/{total}] NOMATCH')

# ── Pass 2: fetch manufacturer site to find model PDF ────────────────────────

def pass2(i, total, fname):
    fpath = os.path.join(PE_DIR, fname)
    text = open(fpath, encoding='utf-8', errors='ignore').read()

    if get_field(text, 'boxbench_datasheet'):
        pprint(f'[{i}/{total}] SKIP-DS {fname}')
        return

    vp    = get_field(text, 'boxbench_vendorpage')
    brand = get_field(text, 'Brand').lower().strip()
    model = get_field(text, 'Model').strip()

    if not vp or not model:
        pprint(f'[{i}/{total}] NO-VP/MODEL {fname}')
        return

    # Find search template for this brand
    search_url = None
    for key, tmpl in BRAND_SEARCH.items():
        if key in brand:
            search_url = tmpl % model.replace(' ', '+')
            break
    if not search_url:
        # Fallback: try manufacturer's own site search
        search_url = f'{vp.rstrip("/")}/?s={model.replace(" ", "+")}'

    pprint(f'[{i}/{total}] search {brand} "{model[:30]}"')
    html = fetch(search_url)
    if not html:
        pprint(f'[{i}/{total}] FAIL')
        return

    pdf = extract_pdf(html, search_url)
    if pdf:
        text = set_field(text, 'boxbench_datasheet', pdf)
        open(fpath, 'w', encoding='utf-8').write(text)
        pprint(f'[{i}/{total}] OK  ds={pdf[:70]}')
    else:
        pprint(f'[{i}/{total}] NO-PDF')

# ── Main ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument('--workers', type=int, default=20)
parser.add_argument('--pass', dest='run_pass', choices=['1','2','both'], default='both')
args = parser.parse_args()

wdr_files = sorted(f for f in os.listdir(PE_DIR) if f.endswith('.wdr'))
total = len(wdr_files)
tasks = [(i+1, total, f) for i, f in enumerate(wdr_files)]

def run_pass(fn, label):
    pprint(f'\n── {label} ({total} files, {args.workers} workers) ──')
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = [pool.submit(fn, *t) for t in tasks]
        for f in as_completed(futs):
            f.result()
    pprint(f'── {label} done in {time.time()-t0:.0f}s ──\n')

if args.run_pass in ('1', 'both'):
    run_pass(pass1, 'Pass 1: PE product pages → vendorpage + PDF')
if args.run_pass in ('2', 'both'):
    run_pass(pass2, 'Pass 2: manufacturer sites → model PDF')
