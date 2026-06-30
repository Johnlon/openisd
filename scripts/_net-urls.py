"""Print Vite network URLs from a server log, classified by likely network type.
Usage: python scripts/_net-urls.py <log-file>
Called by start-http.sh after the server is confirmed up.
"""
import re, sys

log_file = sys.argv[1] if len(sys.argv) > 1 else None
if not log_file:
    sys.exit(0)

try:
    raw = open(log_file, 'rb').read().decode('utf-8', errors='replace')
except OSError:
    sys.exit(0)

clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', raw)
urls = re.findall(r'http://[\d.]+:\d+', clean)
if not urls:
    sys.exit(0)

# Classify: 192.168.0-89.x and 10.0.x.x are typical home/office WiFi.
# 10.5.x, 172.x, 192.168.9x.x tend to be Docker / VMs / WSL.
def is_home(url):
    m = re.match(r'http://(\d+)\.(\d+)\.(\d+)', url)
    if not m:
        return False
    a, b, c = int(m[1]), int(m[2]), int(m[3])
    if a == 192 and b == 168 and c <= 89:
        return True
    if a == 10 and b == 0:
        return True
    return False

home  = [u for u in urls if is_home(u)]
other = [u for u in urls if not is_home(u)]

print()
print('  Phone/tablet access — must be on the same WiFi as this machine:')
if home:
    print('  Likely home/office WiFi:')
    for u in home:
        print(f'    {u}')
if other:
    print('  Other interfaces (VM/Docker/WSL — phone probably cannot reach these):')
    for u in other:
        print(f'    {u}')
