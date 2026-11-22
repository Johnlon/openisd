import {inject, watch, type App, type InjectionKey} from 'vue';
import type {FeatureUse} from '../logic/telemetry/featureUse.js';
import type {AnnouncementCenter} from '../logic/announcementCenter.js';

const AnnouncementCenterKey: InjectionKey<AnnouncementCenter> = Symbol('openisd.announcements');

export function provideAnnouncementCenter(app: App, center: AnnouncementCenter): void {
  app.provide(AnnouncementCenterKey, center);
}

export function useAnnouncementCenter(): AnnouncementCenter {
  const center = inject(AnnouncementCenterKey);
  if (!center) throw new Error('useAnnouncementCenter(): announcements were not provided by the composition root');
  return center;
}

/**
 * Reports the announcement popup to usage statistics: `seen` when it is on screen (not behind the splash), then `dismissed`
 * (the Dismiss button, the cross or the backdrop on the latest one) or `closed` (the list) when it goes away.
 */
export function useAnnouncementTelemetry(center: AnnouncementCenter, splashOpen: () => boolean, featureUse: FeatureUse): void {
  let seen: {readonly id: string; readonly view: 'latest' | 'list'} | null = null;
  watch(() => center.open.value && !splashOpen(), visible => {
    if (!visible || seen !== null) return;
    const view = center.view.value;
    const id = center.latest.value?.id;
    if (view === null || id === undefined) return;
    seen = {id, view};
    featureUse.announcement({kind: 'announcement', stage: 'seen', id, view});
  }, {immediate: true, flush: 'sync'});
  watch(() => center.open.value, open => {
    if (open || seen === null) return;
    featureUse.announcement({kind: 'announcement', stage: seen.view === 'latest' ? 'dismissed' : 'closed', id: seen.id, view: seen.view});
    seen = null;
  }, {flush: 'sync'});
}
