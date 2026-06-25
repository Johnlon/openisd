#!/usr/bin/env python3
"""
Backfill boxbench_vendorpage= and boxbench_source= into WDR files
from cached HTML pages.
"""
import os, re, sys
from urllib.parse import urlparse

ROOT = os.path.join(os.path.dirname(__file__), '..')

# ── WDR helpers ──────────────────────────────────────────────────────────────

def get_field(text, key):
    m = re.search(r'^' + re.escape(key) + r'=(.*)$', text, re.M)
    return m.group(1).strip() if m else ''

def set_field(text, key, value):
    """Set or replace a key= line. Inserts before ParState= if new."""
    pattern = r'^' + re.escape(key) + r'=.*$'
    if re.search(pattern, text, re.M):
        return re.sub(pattern, f'{key}={value}', text, flags=re.M)
    # Insert before ParState=
    insert = f'{key}={value}\n'
    m = re.search(r'^ParState=', text, re.M)
    if m:
        return text[:m.start()] + insert + text[m.start():]
    return text.rstrip('\n') + '\n' + insert

def clear_field(text, key):
    return re.sub(r'^' + re.escape(key) + r'=.*\n?', '', text, flags=re.M)

def is_pdf(url):
    return bool(re.search(r'\.pdf(\?|$)', url, re.I))

# ── SB Acoustics ─────────────────────────────────────────────────────────────

def process_sb_acoustics():
    wdr_dir  = os.path.join(ROOT, 'drivers', 'sb-acoustics')
    html_dir = os.path.join(wdr_dir, '_html')

    # Build {pdf_url → canonical_url} from HTML cache
    pdf_to_canonical = {}
    for fname in os.listdir(html_dir):
        html = open(os.path.join(html_dir, fname), encoding='utf-8', errors='ignore').read()
        canonical_m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        if not canonical_m:
            continue
        canonical = canonical_m.group(1).strip().rstrip('/')
        pdfs = re.findall(r'href="(https://sbacoustics\.com/[^"]*\.pdf[^"]*)"', html)
        for pdf in pdfs:
            pdf_clean = pdf.strip()
            if pdf_clean not in pdf_to_canonical:
                pdf_to_canonical[pdf_clean] = canonical

    updated = 0
    fields_added = {'boxbench_vendorpage': 0, 'boxbench_source': 0}

    for fname in os.listdir(wdr_dir):
        if not fname.endswith('.wdr'):
            continue
        fpath = os.path.join(wdr_dir, fname)
        text = open(fpath, encoding='utf-8', errors='ignore').read()

        # Already done?
        if get_field(text, 'boxbench_vendorpage'):
            continue

        ds = get_field(text, 'boxbench_datasheet')
        if not ds or not is_pdf(ds):
            continue

        canonical = pdf_to_canonical.get(ds)
        if not canonical:
            # Try without query string
            ds_base = ds.split('?')[0]
            canonical = pdf_to_canonical.get(ds_base)
        if not canonical:
            continue

        orig = text
        text = set_field(text, 'boxbench_vendorpage', canonical)
        fields_added['boxbench_vendorpage'] += 1
        # Source = same as vendor page (T/S data from SB Acoustics directly)
        if not get_field(text, 'boxbench_source'):
            text = set_field(text, 'boxbench_source', canonical)
            fields_added['boxbench_source'] += 1

        if text != orig:
            open(fpath, 'w', encoding='utf-8').write(text)
            updated += 1

    print(f'SB Acoustics: {updated} files updated, {fields_added}')
    return updated

# ── SoundImports ─────────────────────────────────────────────────────────────

SKIP_DOMAINS = {
    'dev.visualwebsiteoptimizer.com', 'cdn.webshopapp.com',
    'api.whatsapp.com', 'open.spotify.com', 'listen.tidal.com',
    'open.qobuz.com', 'facebook.com', 'twitter.com', 'instagram.com',
    'youtube.com', 'google.com', 'jquery.com', 'dmws.nl',
    'vwo.com', 'schema.org',
}

def domain(url):
    try:
        return urlparse(url).netloc.lstrip('www.')
    except:
        return ''

def extract_pdf_from_si_html(html):
    """Return first doc.soundimports.nl PDF link, or any .pdf link."""
    pdfs = re.findall(r'href=["\']\s*(https?://doc\.soundimports\.nl[^"\']*\.pdf[^"\']*)\s*["\']', html, re.I)
    if pdfs:
        return pdfs[0].strip()
    pdfs = re.findall(r'href=["\']\s*([^"\']*\.pdf(?:\?[^"\']*)?)\s*["\']', html, re.I)
    pdfs = [p.strip() for p in pdfs if 'font' not in p.lower() and 'icomoon' not in p.lower()]
    return pdfs[0] if pdfs else ''

def process_soundimports():
    wdr_dir  = os.path.join(ROOT, 'drivers', 'soundimports')
    html_dir = os.path.join(wdr_dir, '_html')
    html_files = set(os.listdir(html_dir))

    updated = 0
    fields_added = {'boxbench_source': 0, 'boxbench_vendorpage': 0,
                    'boxbench_datasheet_set': 0, 'boxbench_datasheet_cleared': 0}

    for fname in sorted(os.listdir(wdr_dir)):
        if not fname.endswith('.wdr'):
            continue
        fpath = os.path.join(wdr_dir, fname)
        text = open(fpath, encoding='utf-8', errors='ignore').read()

        orig = text

        # ── Extract source URL from Comment= ────────────────────────────────
        comment = get_field(text, 'Comment')
        src_url = ''
        if comment.startswith('Source:'):
            part = comment[len('Source:'):].strip()
            src_url = part.split(' | ')[0].strip()

        # ── Handle existing non-PDF boxbench_datasheet= ──────────────────────
        ds = get_field(text, 'boxbench_datasheet')
        if ds and not is_pdf(ds):
            d = domain(ds)
            if 'soundimports' in d:
                # It's the retailer's own page — move to source, clear datasheet
                if not get_field(text, 'boxbench_source'):
                    text = set_field(text, 'boxbench_source', ds)
                    fields_added['boxbench_source'] += 1
                text = clear_field(text, 'boxbench_datasheet')
                fields_added['boxbench_datasheet_cleared'] += 1
                ds = ''
            else:
                # It's a manufacturer page — move to vendorpage, clear datasheet
                if not get_field(text, 'boxbench_vendorpage'):
                    text = set_field(text, 'boxbench_vendorpage', ds)
                    fields_added['boxbench_vendorpage'] += 1
                text = clear_field(text, 'boxbench_datasheet')
                fields_added['boxbench_datasheet_cleared'] += 1
                ds = ''

        # ── Set boxbench_source from Comment URL ─────────────────────────────
        if src_url and not get_field(text, 'boxbench_source'):
            text = set_field(text, 'boxbench_source', src_url)
            fields_added['boxbench_source'] += 1

        # ── Look up HTML cache for PDF ───────────────────────────────────────
        effective_src = get_field(text, 'boxbench_source') or src_url
        if effective_src and not ds:
            slug = effective_src.rstrip('/').split('/')[-1]
            html_name = slug + '.html'
            if html_name in html_files:
                html = open(os.path.join(html_dir, html_name),
                            encoding='utf-8', errors='ignore').read()
                pdf = extract_pdf_from_si_html(html)
                if pdf and is_pdf(pdf):
                    text = set_field(text, 'boxbench_datasheet', pdf)
                    fields_added['boxbench_datasheet_set'] += 1

        # ── Final consistency: if datasheet == vendorpage, clear datasheet ───
        ds2 = get_field(text, 'boxbench_datasheet')
        vp2 = get_field(text, 'boxbench_vendorpage')
        if ds2 and vp2 and ds2 == vp2:
            text = clear_field(text, 'boxbench_datasheet')
            fields_added['boxbench_datasheet_cleared'] += 1

        if text != orig:
            open(fpath, 'w', encoding='utf-8').write(text)
            updated += 1

    print(f'SoundImports: {updated} files updated, {fields_added}')
    return updated

# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.chdir(ROOT)
    sb  = process_sb_acoustics()
    si  = process_soundimports()
    print(f'\nTotal WDR files updated: {sb + si}')
