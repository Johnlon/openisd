# BUG_20261017_persist-warning-is-scary

**Status:** FIXED (T378)

## Symptom (as reported)
John, 17 Oct 2026: the startup banner "This browser may delete OpenISD's data when disk space runs
low. Use Chrome, or turn on Google Drive sync and export your projects." is scary. It does not say
whether anything is about to happen, nor whether the user gets an early warning as storage fills.

## Finding
The banner appears when the browser refused or cannot answer `navigator.storage.persist()`
(`persistenceWarning` in `packages/design/fields/browserStorage.ts`). It means only that the
browser is allowed to evict the site's data if the disk itself gets full; nothing is impending.
The app already warns at 80% of the local store or the site quota (`storageFullWarning`), and
Diagnostics shows usage. The text says none of that.

## Fix wanted
Reword the banner so it (1) says nothing is wrong now, (2) says when data could be lost (this
browser, disk nearly full), (3) says the app warns at 80% full and shows usage in Diagnostics,
(4) keeps the advice: Chrome keeps data; Drive sync or export protects it. Short plain English,
one or two sentences. Text lives in `packages/design`; update
`packages/design/test/fields/browserStorage.test.ts` and the banner browser spec.

## Fixed (T378)
The banner now reads: "Nothing is wrong now: this browser could clear OpenISD's data only if your
disk gets nearly full. OpenISD warns you when its storage is 80% full (usage is in Options, Your
data); to be safe, use Chrome, turn on Google Drive sync, or export your projects." Usage is shown
on Options, Your data (both skins), not Diagnostics, so the text names that. The 80% comes from
`STORAGE_FULL_FROM`.
