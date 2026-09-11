import type { InjectionKey, Ref } from 'vue';
import { ref } from 'vue';
import { presentationState, resetUnitTokens } from '../logic/presentationState.js';

export interface OptionsModalAPI {
  readonly activeTab: Ref<'general' | 'plot'>;
  readonly presentationState: typeof presentationState;
  resetUnitTokens(): void;
}

export const OptionsModalKey: InjectionKey<OptionsModalAPI> = Symbol('OptionsModalAPI');

export function useOptionsModal(): OptionsModalAPI {
  const activeTab = ref<'general' | 'plot'>('general');

  return {
    activeTab,
    presentationState,
    resetUnitTokens,
  };
}
