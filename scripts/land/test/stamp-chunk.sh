# Sourced by the shell tests that need a baseline picture stamped as a visual-retake run draws it (T799, T833).
# stamp_chunk <run-id> prints, with no newline, the stamp as png-stamp.mjs writes it: the 4-byte length, `tEXt`, `openisd-visual-run`
# NUL `run=<id>`, then a CRC. The CRC here is four ASCII digits, so a reader that takes digits after `run=` is caught; the readers
# do not check it. The tests' pictures are not real PNGs ("the scripts only move bytes"); this is the part they read.
stamp_chunk() { local n=$((23 + ${#1})); printf "\\x00\\x00\\x00\\x$(printf %02x "$n")tEXtopenisd-visual-run\\0run=%s1234" "$1"; }
