#!/bin/sh
# Single source of truth for openisd runtime paths.
# Sourced by every script that needs a stable per-user directory.
# Env overrides (OPENISD_HEAVY_GATE_DIR, OPENISD_RESERVATION_DIR, ADMIT_DIR)
# still win so tests can point at scratch dirs.

# OPENISD_RUNTIME_DIR is the one root. Default follows XDG_RUNTIME_DIR, then /run/user/<uid>/openisd.
OPENISD_RUNTIME_DIR="${OPENISD_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/openisd}"
mkdir -p "$OPENISD_RUNTIME_DIR"
chmod 0700 "$OPENISD_RUNTIME_DIR" 2>/dev/null || true

# Derived paths — each script uses its own variable; the default is under the runtime dir.
# land.conf reads LAND_LOCK and POST_LAND_LOCK from here (see land.conf).
LAND_LOCK="${LAND_LOCK:-$OPENISD_RUNTIME_DIR/land.lock}"
POST_LAND_LOCK="${POST_LAND_LOCK:-$OPENISD_RUNTIME_DIR/post-land.lock}"
# Held exclusive by the post-land full suite, shared by every agent browser spec run (scripts/suite-lock.sh).
SUITE_RUN_LOCK="${SUITE_RUN_LOCK:-$OPENISD_RUNTIME_DIR/suite-run.lock}"

# Heavy gate reservations (scripts/hooks-local/heavy-gate-concurrency.sh)
OPENISD_HEAVY_GATE_DIR="${OPENISD_HEAVY_GATE_DIR:-$OPENISD_RUNTIME_DIR/heavy-gate-reservations}"
OPENISD_HEAVY_GATE_ACCOUNTING_LOCK="${OPENISD_HEAVY_GATE_ACCOUNTING_LOCK:-$OPENISD_HEAVY_GATE_DIR.lock}"

# UI test reservations (scripts/test-concurrency.sh)
OPENISD_RESERVATION_DIR="${OPENISD_RESERVATION_DIR:-$OPENISD_RUNTIME_DIR/ui-test-reservations}"
OPENISD_RESERVATION_LOCK="${OPENISD_RESERVATION_LOCK:-$OPENISD_RESERVATION_DIR.lock}"

# Admit slots (scripts/admit/record.sh) — per-repo default still uses repo name, but under runtime dir.
# The default is constructed in admit_dir() using the repo name; ADMIT_DIR env still overrides fully.
# This file only ensures the parent exists when ADMIT_DIR is not set.
if [ -z "${ADMIT_DIR:-}" ]; then
    # The actual per-repo directory is built in admit_dir(); we just ensure the parent exists.
    mkdir -p "$OPENISD_RUNTIME_DIR/admit"
fi

# Matt restore work dir (scripts/restore_matt_from_archive.py)
MATT_RESTORE_DIR="${MATT_RESTORE_DIR:-$OPENISD_RUNTIME_DIR/matt-restore}"