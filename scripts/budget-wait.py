#!/usr/bin/env python3
"""Returns when any one of the given lock files can be locked, i.e. when any one of its holders has ended.

    python3 scripts/budget-wait.py <lock file>...

One thread per file blocks in flock(2), so the wait costs no CPU and is not polling; the kernel wakes the
thread whose holder ended. The first to get its lock releases it again and the call returns 0."""
import fcntl
import sys
import threading

files = sys.argv[1:]
if not files:
    sys.exit("usage: budget-wait.py <lock file>...")
done = threading.Event()


def wait_on(path):
    with open(path, "w") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        done.set()
        # leaving the with-block closes the file and drops the lock again


threads = [threading.Thread(target=wait_on, args=(path,), daemon=True) for path in files]
for thread in threads:
    thread.start()
done.wait()
