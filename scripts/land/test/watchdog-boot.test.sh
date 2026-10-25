#!/usr/bin/env bash
# T304: the watchdog unit runs origin/main's watchdog, never a file in the main checkout. A scratch repo
# whose checkout lags origin/main and holds an uncommitted copy of watchdog.sh; the installer into scratch
# dirs. processes.md rule 7.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/watchdog-boot.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# A scratch origin with a stand-in watchdog.sh that says which copy ran; the "main checkout" lags it.
git init -q --bare "$SCRATCH/origin.git"
git clone -q "$SCRATCH/origin.git" "$SCRATCH/checkout" 2> /dev/null
cd "$SCRATCH/checkout" || exit 2
git symbolic-ref HEAD refs/heads/main; mkdir -p scripts/land
printf '#!/usr/bin/env bash\necho "ran origin v1 repo=$WATCHDOG_REPO args=$*"\n' > scripts/land/watchdog.sh
git add -A; git commit -qm v1; git push -q origin main
git clone -q "$SCRATCH/origin.git" "$SCRATCH/other" 2> /dev/null
( cd "$SCRATCH/other" && printf '#!/usr/bin/env bash\necho "ran origin v2 repo=$WATCHDOG_REPO args=$*"\n' > scripts/land/watchdog.sh \
  && git commit -qam v2 && git push -q origin main )
printf '#!/usr/bin/env bash\necho "ran the CHECKOUT copy"\n' > scripts/land/watchdog.sh   # uncommitted, lagging

# 1. the boot script runs origin/main's newest watchdog.sh, not the checkout's, not the checkout's HEAD
out=$(WATCHDOG_REPO="$SCRATCH/checkout" timeout 60 bash "$REPO_SRC/scripts/land/watchdog-boot.sh" x 2>&1)
[ "$out" = "ran origin v2 repo=$SCRATCH/checkout args=x" ] && ok "boot runs origin/main's watchdog (fetched), not the checkout's" || fail "boot ran: $out"
[ "$(git -C "$SCRATCH/checkout" status --porcelain)" = " M scripts/land/watchdog.sh" ] && ok "the checkout is left as it was" || fail "checkout changed"

# 2. no origin/main watchdog: loud failure, nothing run
( cd "$SCRATCH/other" && git rm -q scripts/land/watchdog.sh && git commit -qm rm && git push -q origin main )
out=$(WATCHDOG_REPO="$SCRATCH/checkout" timeout 60 bash "$REPO_SRC/scripts/land/watchdog-boot.sh" 2>&1); r=$?
[ $r = 2 ] && grep -q "cannot read origin/main" <<< "$out" && ! grep -q CHECKOUT <<< "$out" && ok "no watchdog on origin/main: exit 2, nothing run" || fail "missing watchdog (r=$r): $out"

# 3. the installer copies (no symlinks), and the unit names no file in the repo
units="$SCRATCH/units"; boot="$SCRATCH/libexec"; mkdir -p "$units"
ln -s "$REPO_SRC/scripts/land/watchdog.service" "$units/openisd-watchdog.service"   # the old install
WATCHDOG_UNIT_DIR="$units" WATCHDOG_BOOT_DIR="$boot" WATCHDOG_NO_SYSTEMCTL=1 bash "$REPO_SRC/scripts/land/watchdog-install.sh" > /dev/null
if [ -f "$units/openisd-watchdog.service" ] && [ ! -L "$units/openisd-watchdog.service" ] && [ ! -L "$units/openisd-watchdog.timer" ] \
   && [ -x "$boot/watchdog-boot.sh" ] && [ ! -L "$boot/watchdog-boot.sh" ] && cmp -s "$boot/watchdog-boot.sh" "$REPO_SRC/scripts/land/watchdog-boot.sh"; then
    ok "installer copies the units and the boot script, replacing an old symlink"; else fail "install: $(ls -l "$units" "$boot")"; fi
exec_line=$(grep '^ExecStart=' "$units/openisd-watchdog.service")
[ "$exec_line" = "ExecStart=/usr/bin/bash %h/.local/libexec/openisd/watchdog-boot.sh" ] && ok "the unit runs the installed boot script only" || fail "ExecStart: $exec_line"

[ $fails = 0 ] && { echo "watchdog-boot: all passed"; exit 0; }
echo "watchdog-boot: $fails failed"; exit 1
