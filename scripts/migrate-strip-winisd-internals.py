"""
migrate-strip-winisd-internals.py

Remove WinISD-internal computed/box fields from all WDR files.
These were injected by scrapers as zero defaults or WinISD-computed
values — they are not driver T/S parameters and pollute the dataset.

Fields removed:
  fLe KLe Dia no Hc Hg SPLmax SPLmaxLF USPL alfaVC
  Rt Ct gamma Rme Mpow Mcost Gloss
  c roo Thick Depth MagDepth Magnet Basket Outer Vcd DVol

Fields kept (genuine driver properties or WinISD-required structural):
  All T/S params (Fs Qts Re Le BL Mms Cms Sd Vas Xmax Pe ...)
  Derived T/S (Vd Dd EBP)
  numVC VCCon ParState

Run: python scripts/migrate-strip-winisd-internals.py [--dry-run]
"""
import sys, pathlib, argparse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DRIVERS_DIR = pathlib.Path(__file__).parent.parent / "drivers"

STRIP = {
    'fLe', 'KLe', 'Dia', 'no', 'Hc', 'Hg',
    'SPLmax', 'SPLmaxLF', 'USPL', 'alfaVC',
    'Rt', 'Ct', 'gamma', 'Rme', 'Mpow', 'Mcost', 'Gloss',
    'c', 'roo',
    'Thick', 'Depth', 'MagDepth', 'Magnet', 'Basket', 'Outer',
    'Vcd', 'DVol',
}


def strip_file(text: str) -> tuple[str, int]:
    lines = text.splitlines(keepends=True)
    out, removed = [], 0
    for line in lines:
        key = line.split('=', 1)[0].strip() if '=' in line else ''
        if key in STRIP:
            removed += 1
        else:
            out.append(line)
    return ''.join(out), removed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    total_files = total_removed = 0

    for wdr in sorted(DRIVERS_DIR.rglob('*.wdr')):
        text = wdr.read_text(encoding='utf-8', errors='replace')
        new_text, n = strip_file(text)
        if n == 0:
            continue
        total_files += 1
        total_removed += n
        if args.dry_run:
            print(f'[DRY] -{n} fields: {wdr.relative_to(DRIVERS_DIR)}')
        else:
            wdr.write_text(new_text, encoding='utf-8')

    tag = '[DRY RUN] ' if args.dry_run else ''
    print(f'\n{tag}Stripped {total_removed} fields from {total_files} files.')


if __name__ == '__main__':
    main()
