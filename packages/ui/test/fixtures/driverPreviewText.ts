import type {NumberField} from '@openisd/design/fields';

/** Expected preview text from the stored figure under the four-significant-figure rule. */
export function driverPreviewText(field: NumberField, storedValue: number): string {
  const fieldText = field.format(storedValue);
  const [mantissa] = fieldText.split('e');
  const significantDigits = mantissa.replace(/[.-]/g, '').replace(/^0+/, '').length;
  if (significantDigits <= 4) return fieldText;
  return String(Number(field.toDisplay(storedValue).toPrecision(4)));
}
