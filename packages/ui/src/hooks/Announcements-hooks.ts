import {inject, type App, type InjectionKey} from 'vue';
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
