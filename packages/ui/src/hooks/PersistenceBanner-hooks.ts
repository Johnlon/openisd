/** The startup warning when the browser may clear OpenISD's data: shown until dismissed in this
 *  browser. The rule and the words are the design layer's (`persistenceBanner`). */
import {getCurrentScope, onScopeDispose, ref, type Ref} from 'vue';
import {persistenceBanner} from '@openisd/design/fields';
import {useApp} from '../logic/app.js';

export interface PersistenceBannerAPI {
  /** The warning to show; null when none. */
  readonly text: Readonly<Ref<string | null>>;
  dismiss(): void;
}

export function usePersistenceBanner(): PersistenceBannerAPI {
  const {persistence} = useApp();
  const read = (): string | null => persistenceBanner(persistence.outcome(), persistence.bannerDismissed());
  const text = ref(read());
  const stop = persistence.watch(() => { text.value = read(); });
  if (getCurrentScope()) onScopeDispose(stop);
  return {text, dismiss: () => persistence.dismissBanner()};
}
