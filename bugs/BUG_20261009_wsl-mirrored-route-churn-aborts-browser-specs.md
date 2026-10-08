# BUG_20261009_wsl-mirrored-route-churn-aborts-browser-specs

**Status:** OPEN (fix is a Windows-side .wslconfig change, with John)

## Symptom

Browser specs fail in bursts of 81–89 Chrome `net::ERR_NETWORK_CHANGED` errors: Vite module
loads abort mid-flight, Vue never mounts, the spec times out. Worse under load; overnight
runs mostly escape it.

## Evidence

(fab, 2026-10-08/09, all re-checked in-session, read-only)

- eth0's whole IPv4 route set — 192.168.0.0/24, 192.168.0.1/32 and the default gateway — is
  deleted and re-added repeatedly: paired `RTM_DELROUTE`/`RTM_NEWROUTE` netlink events in
  `journalctl`, e.g. 2026-10-08 23:57:11 and again 23:57:16. Logged by tailscaled's route
  monitor, which is only the witness: `tailscale status` shows `BackendState: Stopped`.
- Cadence: 1–6 default-route flaps per minute through 22:58–23:57 on 2026-10-08.
- Historical match: the red run `build/test-logs/20261007-180514-487955.log` (164
  `ERR_NETWORK_CHANGED`) sat in a window with 15 default-route flaps (journal, 2026-10-07
  18:00–19:10); a control window the same day (04:00–05:10) had 0. Flaps come with active
  host periods — exactly when suites run red.
- WSL's own host check fails inside a flap burst: `WSL (152) ERROR: CheckConnection:
  getaddrinfo() failed: -5` at 2026-10-08 23:35:52, within the 23:35 six-flap burst.
- Mirrored networking confirmed: `networkingMode=mirrored` in `/mnt/c/Users/johnl/.wslconfig`;
  eth0 carries the LAN address 192.168.0.48/24.
- Not us: no repo script touches interfaces or routes (grep `ip route|ip link|ip addr|nmcli|
  ifconfig` over openisd/scripts, winisd_tools, agentutils: zero hits). Docker idle (0
  containers, bridges DOWN), no IPv6 temporary addresses on eth0.

## Cause

WSL mirrored networking re-syncs the mirrored host network state into the guest, dropping
and re-adding eth0's routes each time. Chrome's network-change notifier treats any route
change as a network change and aborts every in-flight request — localhost requests included
— as `ERR_NETWORK_CHANGED`. Under load the in-flight window per module load is longer, so
one flap kills more loads. ⚠ unverified: which Windows-side component triggers each re-sync
(Hyper-V firewall re-apply is the commonly named driver); the flaps themselves and their
correlation are proven above.

## Fix

Windows side, John, then `wsl --shutdown`:

1. First try keeping mirrored mode and setting `firewall=false` under `[wsl2]` in
   `C:\Users\johnl\.wslconfig` (⚠ unverified that this stops it here — verify by the journal
   flap count going to ~0 over an hour).
2. If the churn persists: `networkingMode=NAT` + `localhostForwarding=true`. NAT routes are
   static, which removes the cause outright. Cost: the phone loses direct LAN access to
   port 4000 and needs a `netsh portproxy`.

No Chrome flag disables the network-change abort; do not chase one.

## Verification

After the change: `journalctl --since "1 hour ago" | grep -c 'RTM_DELROUTE.*gw=192.168.0.1'`
stays at 0 across an active hour, and a browser-suite run during active host use shows zero
`ERR_NETWORK_CHANGED` in its log.
