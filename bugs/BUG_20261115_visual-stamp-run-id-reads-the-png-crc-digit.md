# BUG_20261115_visual-stamp-run-id-reads-the-png-crc-digit

**Status:** OPEN

## Symptom
About one re-take in 26 stamps every picture with a run id that is wrong by one digit, and the pull request's `task` job refuses them:
"the stamp names run 437466063290, which is not a successful visual-retake run" (T830, PR #130, 15 Nov 2026; the run was 43746606329).

## Steps to reproduce
1. Take a stamped baseline whose run id's `tEXt` chunk has a CRC-32 whose first byte is an ASCII digit (0x30 to 0x39): run 43746606329 gives `0x30`.
2. `LC_ALL=C grep -a -o 'openisd-visual-run.run=[0-9]*' <picture>.png | sed 's/.*run=//'` prints `437466063290`. Expected `43746606329`.
3. `VISUAL_VERIFY_RUN=1 bash scripts/visual/check-task.sh tasks/T830.yml <base> HEAD` asks GitHub for run 437466063290 and gets 404.

## Evidence
`scripts/visual/check-task.sh:34` reads the id with `run=[0-9]*`. The stamp is a PNG `tEXt` chunk `openisd-visual-run\0run=<id>` followed by its 4-byte CRC, which is the same for every picture of a run (it covers only the keyword and text). Task job log of run 43748814744. Four of four pictures of the run carried the trailing `0`.

## Cause
The reader takes every digit after `run=`; the CRC's first byte, when it is a digit, is read as part of the id. About 10 in 256 run ids are affected.

## Fix
Not done here. Read the chunk by its length (parse the PNG chunks), or end the stamp text with a non-digit (`run=<id>;`) and the reader at it. A test with a run id whose CRC starts with a digit (43746606329) would have caught it.

## Verification
`check-task.sh` reads 43746606329 from a picture stamped with that run.
