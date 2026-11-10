import type {InjectionKey} from 'vue';
import type {PhoneRowColumns} from '@openisd/design/fields';

/** The column widths a field row takes when it is not given its own: a screen provides these for the fields inside it. */
export const PHONE_COLUMNS_KEY: InjectionKey<PhoneRowColumns> = Symbol('PhoneRowColumns');
