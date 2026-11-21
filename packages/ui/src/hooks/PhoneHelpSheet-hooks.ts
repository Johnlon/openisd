/** The phone help sheet. It is mounted only while the user has help open, so its setup counts one use. */
import {onBeforeUnmount, onMounted, ref, type Ref} from 'vue';
import {useFeatureUse} from './telemetryContext.js';

export interface HelpSheetScroll {
  sheetEl: Ref<HTMLElement | null>;
  /** True while the sheet holds text below what it shows; the sheet then says so (John, 21 Nov 2026: "it's clipped"). */
  moreBelow: Ref<boolean>;
  measure: () => void;
}

export function usePhoneHelpSheet(): HelpSheetScroll {
  useFeatureUse().feature('help');
  const sheetEl = ref<HTMLElement | null>(null);
  const moreBelow = ref(false);
  const measure = (): void => {
    const el = sheetEl.value;
    if (el === null) return;
    moreBelow.value = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
  };
  let observer: ResizeObserver | undefined;
  onMounted(() => {
    measure();
    observer = new ResizeObserver(measure);
    if (sheetEl.value !== null) observer.observe(sheetEl.value);
  });
  onBeforeUnmount(() => observer?.disconnect());
  return {sheetEl, moreBelow, measure};
}
