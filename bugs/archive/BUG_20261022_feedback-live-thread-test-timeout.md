# BUG_20261022_feedback-live-thread-test-timeout

**Status:** FIXED (T570)

## Symptom
`feedback_page_test.RuledPictures.test_live_thread_send_order_and_poll` failed on main: `timeout line "no answer yet; sent to bob"`.

## Cause
The test was stale. The board's thread module (`_agent_files/board-state/thread.js`, served as /board/thread.js) changed its 130 s timeout line from "no answer yet; bob will answer" to "no answer yet; sent to bob" (board change QO299.c1-c8: no "X will answer"). The test still expected the old words. The page is correct.

## Fix
`scripts/feedback/feedback_page_live_test.mjs` expects "no answer yet; sent to bob".
Note: `_agent_files/bin/board_usability_test.mjs` (workspace repo, outside this repo) still matches `will answer` and needs the same update.
