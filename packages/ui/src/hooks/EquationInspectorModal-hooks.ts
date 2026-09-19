import type {InjectionKey} from 'vue';
import type {ProvenanceInfo} from '../logic/provenance.js';

export interface EquationInspectorModalProps {
  open: boolean;
  targetField: string | null;
  provenanceInfo: ProvenanceInfo | null;
}

export interface EquationInspectorModalAPI {
  close(emit: (event: 'close') => void): void;
}

export const EquationInspectorModalKey: InjectionKey<EquationInspectorModalAPI> = Symbol('EquationInspectorModalAPI');

export function useEquationInspectorModal(): EquationInspectorModalAPI {
  function close(emit: (event: 'close') => void): void {
    emit('close');
  }

  return {
    close,
  };
}
