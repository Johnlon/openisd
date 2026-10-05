import type {Ref} from 'vue';

/** One name box in SaveToLibraryDialog: a driver asks Brand and Model, a passive radiator its name. */
export interface SaveToLibraryField {
  readonly label: string;
  readonly placeholder: string;
  /** The caller's ref the box edits. */
  readonly text: Ref<string>;
  /** Class on the input, so a spec can find it. */
  readonly inputClass: string;
}
