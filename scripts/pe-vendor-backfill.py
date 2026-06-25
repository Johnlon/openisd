#!/usr/bin/env python3
"""
Backfill boxbench_vendorpage= for Parts Express WDR files.
PE pages are JS-only so we can't scrape them; instead we map Brand= to the
manufacturer's homepage. Not a specific product page, but better than nothing.
"""
import os, re, sys

PE_DIR = os.path.join(os.path.dirname(__file__), '..', 'drivers', 'parts-express')

# Brand → manufacturer homepage
BRAND_URLS = {
    'Aurum Cantus':         'https://www.aurumcantus.com/',
    'B&C Speakers':         'https://www.bcspeakers.com/',
    'Beston':               'https://www.bestonaudio.com/',
    'Beyma':                'https://www.beyma.com/',
    'CSS':                  'https://creativesound.ca/',
    'Celestion':            'https://celestion.com/',
    'Ciare':                'https://www.ciare.com/',
    'DS18':                 'https://www.ds18.com/',
    'Dayton Audio':         'https://www.daytonaudio.com/',
    'Dynavox':              'https://www.dynavox.eu/',
    'EPIQUE by Dayton Audio': 'https://www.daytonaudio.com/',
    'Eminence Speaker':     'https://eminence.com/',
    'Factory Buyouts':      '',
    'FaitalPRO':            'https://www.faitalpro.com/',
    'Fountek':              'https://www.fountek.net/',
    'GRS':                  'https://www.parts-express.com/brands/grs',
    'Goldwood':             'https://www.goldwoodsound.com/',
    'HiVi':                 'https://www.hiviusa.com/',
    'Lavoce':               'https://www.lavoce-usa.com/',
    'Morel':                'https://www.morelhifi.com/',
    'PRV Audio':            'https://www.prvaudio.com/',
    'Parts Express':        'https://www.parts-express.com/',
    'Peerless India':       'https://www.peerlessindia.com/',
    'Peerless by Tymphany': 'https://www.tymphany.com/',
    'Pyramid':              'https://pyramidsound.com/',
    'Selenium':             'https://selenium.com.br/',
    'Tang Band':            'https://www.tb-speaker.com/',
    'Tectonic':             'https://www.tectonicelements.com/',
    'Timpano Audio':        'https://www.timpanoaudio.com/',
    'Usher':                'https://www.usherbe.com/',
    'Visaton':              'https://www.visaton.de/',
    'Wavecor':              'https://www.wavecor.com/',
}

def get_field(text, key):
    m = re.search(rf'^{re.escape(key)}=(.*)$', text, re.M)
    return m.group(1).strip() if m else ''

def set_field(text, key, value):
    """Insert key=value before ParState= if not already present."""
    if re.search(rf'^{re.escape(key)}=', text, re.M):
        return text, False  # already set
    lines = text.split('\n')
    idx = next((i for i, l in enumerate(lines) if l.startswith('ParState=')), len(lines))
    lines.insert(idx, f'{key}={value}')
    return '\n'.join(lines), True

files = sorted(f for f in os.listdir(PE_DIR) if f.endswith('.wdr'))
total = len(files)
updated = 0
skipped = 0
no_brand = 0

for i, fname in enumerate(files, 1):
    fpath = os.path.join(PE_DIR, fname)
    text = open(fpath, encoding='utf-8', errors='ignore').read()

    print(f'[{i}/{total}] {fname}', end=' -> ', flush=True)

    # Skip if already set
    if get_field(text, 'boxbench_vendorpage'):
        print('SKIP (already set)', flush=True)
        skipped += 1
        continue

    brand = get_field(text, 'Brand')
    url = BRAND_URLS.get(brand, '')

    if not url:
        print(f'NO-MATCH (brand={repr(brand)})', flush=True)
        no_brand += 1
        continue

    text, changed = set_field(text, 'boxbench_vendorpage', url)
    if changed:
        open(fpath, 'w', encoding='utf-8').write(text)
        updated += 1
        print(f'vendorpage={url}', flush=True)
    else:
        print('SKIP (already set)', flush=True)
        skipped += 1

print(f'\n=== DONE: {updated} updated, {skipped} skipped, {no_brand} no-match ===')
