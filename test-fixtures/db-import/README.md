# db-import — generated, do not edit

Copies of driver records from `winisd_drivers/db`, made by `scripts/import-test-fixtures.mjs`
(every local `predev`/`prebuild` runs it; it fails if the db is absent, except under CI). Tests read these copies, never the db.
Refresh: any local build, then commit the changed copies.
