// Vitest setup file: a test never inherits the queue ticket of the slow run that runs it.
//
// slow-run.sh exports SLOW_RUN_TICKET, so anything started under it passes straight through the
// queue. The script tests start their own queue runs and must see an empty queue, so they would
// fail inside every queued pre-commit and pass outside it.
delete process.env.SLOW_RUN_TICKET;
delete process.env.SLOW_RUN_LABEL;
delete process.env.SLOW_RUN_OWNER;
