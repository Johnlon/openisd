/** A stand-in for snapshots.openisd.app, the site the app reads its hosted-builds list from
 *  (packages/ui/src/logic/versionIndex.ts). The suite depends on this repo only, never on that live
 *  site: the stand-in answers with an empty list, which the app treats as a list that names no build.
 *  A spec that needs a list routes `**\/v/index.json` itself; its route, added later, wins. */
import type {BrowserContext} from '@playwright/test';

export async function standInForSnapshotsSite(context: BrowserContext): Promise<void> {
  await context.route('https://snapshots.openisd.app/**', route => route.fulfill({json: []}));
}
