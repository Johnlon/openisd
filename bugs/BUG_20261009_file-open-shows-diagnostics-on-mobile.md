# BUG_20261009_file-open-shows-diagnostics-on-mobile

**Status:** OPEN

## Symptom
John, 9 Oct 2026, mobile (Android Chrome, openisd.app): opening the file-open dialog shows an "OpenISD diagnostics" dump (url, agent, faults, stored keys with byte sizes) instead of, or as well as, the file list.

## Evidence
Reported by John. Stored keys at the time: openisd_projects 868819 B, openisd_projects_backup 868939 B, openisd_open_sessions 470554 B, openisd_open_sessions_backup 482340 B, others small: about 2.7 MB of browser storage, over half of a typical 5 MB limit.

## Cause
⚠ unverified: the mobile file-open dialog renders the diagnostics view (a debug path) in place of the file list.

## Fix
- The file-open dialog shows the file list; diagnostics only from an explicit "Diagnostics" action.
- Storage size: the duplicate open projects (BUG_20261009_same-project-opens-many-times) inflate open_sessions; check the total against the browser quota and warn before it is reached.

## Verification
Browser spec at phone width: open the file dialog → file list visible, no diagnostics text.
