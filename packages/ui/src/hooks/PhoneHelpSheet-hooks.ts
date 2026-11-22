/** The phone help sheet. It is mounted only while the user has help open, so its setup counts one use. */
import {useFeatureUse} from './telemetryContext.js';

export function usePhoneHelpSheet(): void {
  useFeatureUse().feature('help');
}
