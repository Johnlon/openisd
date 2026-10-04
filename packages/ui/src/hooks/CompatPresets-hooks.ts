/**
 * The WinISD Compatibility preset row, in both shells: the presets the design package defines
 * (`CompatPreset`), which one the focused project matches, and applying one. Display only: the
 * presets, their membership and the "Custom" label live in `packages/design`.
 */
import {computed} from 'vue';
import type {ComputedRef} from 'vue';
import {CompatPreset} from '@openisd/design';
import {projectChanged} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';

export interface CompatPresetsAPI {
  readonly presets: readonly CompatPreset[];
  /** The preset the project matches, or null for a custom mix. */
  readonly current: ComputedRef<CompatPreset | null>;
  readonly currentLabel: ComputedRef<string>;
  apply(preset: CompatPreset): void;
}

export function useCompatPresets(): CompatPresetsAPI {
  const project = useFocusedProject();
  const current = computed(() => {
    void projectChanged.value;
    return project.value.compatPreset;
  });
  return {
    presets: CompatPreset.ALL,
    current,
    currentLabel: computed(() => CompatPreset.labelOf(current.value)),
    apply: (preset: CompatPreset) => project.value.applyCompatPreset(preset),
  };
}
