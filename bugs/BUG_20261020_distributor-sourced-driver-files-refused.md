# BUG_20261020_distributor-sourced-driver-files-refused

**Status:** FIXED (T482).

There are two lists of source roles, the schema's and sourceRank's. sourceRank ranks the three distributor roles, but the schema allowed only the three manufacturer roles. We need the schema to allow all six.

- Seen: Dayton CFC100-4, DS175-PR, HARB252-8 and SD270A-88 in the driver db have Parts Express spec sheets and pages as sources. Their conversion was refused with `'data_sources.value': Unrecognized keys: "distributor_datasheet", "distributor_product_page"` (rebuild_error.alert, 20 Oct 2026), so they have no openisd.json or .wdr.
- Ruling: QO282, John 19 Oct 2026: "of course we use ... any alternative source ... as backup". QO290, 20 Oct: "finish it".
- Fix: `packages/design/domain/openisdSchema.ts` accepts `distributor_datasheet`, `distributor_product_page` and `distributor_listing_page` in `data_sources`.
- Test: `packages/design/test/domain/data-sources-schema.test.ts` converts the real CFC100-4 record (fixture copied from the db) with no error, and its Fs of 94 Hz reaches the .wdr.
- Follow-up for the tools session: re-run the projection on those four folders so their alerts clear.
