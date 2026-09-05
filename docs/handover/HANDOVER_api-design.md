# Handover — session `api-design`

Session id `6f291f86-ad6e-4dc1-bd04-b765995882c2`, openisd, branch `dev`, 2026-09-04.

## What was asked

Re-analyse every open `QO` ledger entry, confirm each still describes reality, record a
datetime with the re-confirmation, and delete the ones that are junk.

## What was actually done

The re-verification was completed. **Nothing was written to `questions.yml`** — the session was
interrupted before any `inbox.py put`/`close` call. Every finding below exists only here.

`file-spec` (pid 1042) was editing `questions.yml` concurrently during this session and closed
QO91, QO92, QO94, QO95, QO96, QO97 on its own stream. Those are not this session's work.

## Findings — each checked against the tree on 2026-09-04

| Q | Verdict | Evidence found this session |
|---|---|---|
| QO98 | **LIVE, and worse than written** | `vitest.config.ts:11-16` coverage `include` names three paths, two of which are gone: `packages/engine/src` GONE, `packages/winisd/src` GONE, `packages/model/src` present, `packages/ui/src` present. `packages/design` and `packages/persistence` exist and are unmeasured. The entry says one deleted path; there are two. |
| QO99 | **PARTLY BUILT** | The ruled two-file bridge exists: `packages/design/winisd/driverYmlToOpenisdAndWdr.ts:512` exports `driverYmlToOpenisdAndWdr(driverYmlText)`. The three items the entry lists as "still undecided" (the two dq field names in openisd.yml; whether the bundler computes marks from the app engine or a dedicated rule set; what happens to the scraper's existing `dq_marks`) were not checked and remain open. |
| QO100 | **SUBJECT IS GONE** | Zero `as HTML*Element` casts remain in any `.vue` file under `packages/ui/src`. The gate at `packages/design/test/architecture-no-casts.test.ts:105` does glob and scan `.vue` `<script>` blocks, so the zero is real, not a scan gap. The single repo-wide hit is `packages/ui/src/logic/domEvents.ts:5` — a mention inside a comment, in the helper written to remove these. The exemption `DOM_ELEMENT_CAST` at line 123 now covers nothing. |
| QO109 | **NUMBERS STALE, QUESTION LIVE** | `drivers-bundle.json` has changed shape: top keys are now `_generated`, `sources`, `passiveRadiators`; `sources[0].files` holds 1986 entries, not the 1893 flat records the body cites. Disk holds 2064 `driver.yml`. The rebuild-vs-type-gap question is still unanswered. A note recording the new shape was already added by another stream on 2026-09-04. |
| QO112 | **DISSOLVED** | The entry's whole premise was `const schema: z.ZodType<OpenISDDeviceJson>` being a one-way assignability check. That annotation no longer exists. The schema moved to `packages/design/domain/openisdRecordSchema.ts` and the direction inverted: line 147 declares `openISDDeviceJsonSchema`, line 218 derives `export type OpenISDDeviceJson = z.infer<typeof openISDDeviceJsonSchema>`. The schema is now the single authority and the type is generated from it, so there is no second declaration to drift from. Neither proposed fix is needed. |
| QO113 | **RESOLVED IN CODE** | `openisdRecordSchema.ts:188-190` reads `provided_by: textField.optional()`, `comment: textField.optional()`, `added: textField.optional()`. `model_openisd.py:69-71` declares all three `Optional[ScrapedField[str]] = None`. The three authorities now agree; the disagreement the entry describes is gone. |
| QO85 | **PREMISE GONE** | The entry says alignments "each carry exactly one `vent: OpenISDVent` field" and cannot represent ABC's three ports. `packages/design/domain/project.ts` now has a `vents` structure per box type: `Bandpass6Box` (line 554) carries `vents.rear` + `vents.front`; `AbcBox` (line 578) carries `vents.rear` + `vents.front` + `vents.intra`, with a comment explaining the third port connects the two chambers and deliberately has no losses field (no probe evidence for one). The structural gap the question was raised about is closed. Whether John still wants bandpass6/abc left unbuilt is a separate matter — his 2026-08-23 "don't add bandpass6/abc yet" is what the DEFERRED status records. |
| QO87 | Not re-checked | Deferred; answered "not now" on 2026-09-04. |

## Recommended ledger actions, none of them taken

- QO112 — close. Subject no longer exists; the inversion to `z.infer` removes the failure mode.
- QO113 — close. Fixed in code.
- QO100 — close, or narrow to "remove the now-dead `DOM_ELEMENT_CAST` exemption from the gate".
- QO85 — the structural half is answered; the "don't build it yet" half is John's standing ruling.
- QO98, QO99, QO109 — stay open, all three genuinely live.

Each close needs John's ack, not an agent's. QO112 and QO113 are the only two where the code
alone settles it.

## Tree state observed

272 unit failures at session start, of which 246 come from one missing API:
`wdr-openisd-round-trip.test.ts:132` calls `OpenISDDriver.fromWinISDDriver(...)`, which does not
exist in source — the only hits are two mentions inside comments in commented-out code in
`openisdYamlToWdr.ts`. Three more gates fail with `ENOENT: scandir 'packages/winisd/src'`,
scanning the directory that the `packages/design/winisd/` move deleted. Not investigated further
and not this session's stream.

## Other activity

Replied to cross-session connectivity pings from two AGY instances (`agy-8bad3845`,
`agy-59ed3c8c`) and a status check from `file-spec`. `agy-8bad3845` round-tripped, confirming the
bus is bidirectional. `agy-59ed3c8c` never replied to either of two acks.
