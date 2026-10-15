/**
 * `portFieldsView` — what the port-fields overlay shows of one port: the values its three selects
 * display, the cells its number fields bind, and the writes its selects make. The overlay takes
 * this and never the domain's own port.
 */
import type {Vent} from '@openisd/design';
import type {ClearableUICell} from '../ui/components/uiFieldBinding.js';

export type PortShape = 'round' | 'slotted';

export interface PortFieldsView {
  readonly count: number;
  readonly shape: PortShape;
  readonly endCorrection: number;
  readonly width: ClearableUICell;
  readonly height: ClearableUICell;
  readonly diameter: ClearableUICell;
  readonly length: ClearableUICell;
  setCount(n: number): void;
  setShape(shape: PortShape): void;
  setEndCorrection(k: number): void;
}

export function portFieldsView(vent: Vent): PortFieldsView {
  return {
    count: vent.count.value,
    shape: vent.shape.value,
    endCorrection: vent.endCorrection_m.value,
    width: vent.width_m,
    height: vent.height_m,
    diameter: vent.diameter_m,
    length: vent.length_m,
    setCount: n => vent.count.set(n),
    setShape: shape => vent.shape.set(shape),
    setEndCorrection: k => vent.endCorrection_m.set(k),
  };
}
