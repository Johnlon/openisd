import type {OpenISDDriver} from '@openisd/design';
import type {FeatureUse} from './featureUse.js';
import {driverTelemetryId} from './projectDriver.js';

/** The ids of the driver's stated values that disagree with each other (what the "N values disagree" link counts). */
export function disagreeingFieldIds(driver: OpenISDDriver): readonly string[] {
  const ids: string[] = [];
  for (const issue of driver.issues()) {
    if (issue.kind === 'inconsistent-inputs' && !ids.includes(issue.target)) ids.push(issue.target);
  }
  return ids;
}

/** The "N values disagree" link is showing for `driver`: one `values_problem_seen` per field (once per field per driver per session). */
export function reportDisagreementsSeen(featureUse: FeatureUse, driver: OpenISDDriver): void {
  const id = driverTelemetryId(driver);
  for (const field of disagreeingFieldIds(driver)) featureUse.valuesProblemSeen({kind: 'values_problem_seen', problem: 'disagree', field, driver: id});
}
