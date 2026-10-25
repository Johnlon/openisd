/**
 * `portFieldsView` — what the port-fields overlay shows of one port: the values its three selects
 * display, the cells its number fields bind, and the writes its selects make. The overlay takes
 * this and never the domain's own port.
 */
import type {OpenISDProject, Vent} from '@openisd/design';
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

export function portFieldsView(vent: Vent, project: OpenISDProject): PortFieldsView {
  const edit = (write: () => void) => project.batch(() => {
    write();
    project.notifyVentChanged();
  });
  const wrapCell = (cell: ClearableUICell): ClearableUICell => ({
    get name() { return cell.name; },
    get value() { return cell.value; },
    get entered() { return cell.entered; },
    get precision() { return cell.precision; },
    get provenance() { return cell.provenance; },
    get dq() { return cell.dq; },
    get mandatoryAndUnsatisfied() { return cell.mandatoryAndUnsatisfied; },
    set: (value, precision) => edit(() => cell.set(value, precision)),
    clear: () => edit(() => cell.clear()),
  });
  return {
    count: vent.count.value,
    shape: vent.shape.value,
    endCorrection: vent.endCorrection_m.value,
    width: wrapCell(vent.width_m),
    height: wrapCell(vent.height_m),
    diameter: wrapCell(vent.diameter_m),
    length: wrapCell(vent.length_m),
    setCount: n => edit(() => vent.count.set(n)),
    setShape: shape => edit(() => {
      if (shape === 'slotted' && vent.shape.value === 'round'
        && vent.width_m.value === null && vent.height_m.value === null) {
        const area = vent.area_m2.value;
        if (area !== null && area > 0) {
          const {width_m, height_m} = vent.equivalentSlotDimensions_m(area);
          vent.width_m.set(width_m);
          vent.height_m.set(height_m);
        }
      }
      vent.shape.set(shape);
    }),
    setEndCorrection: k => edit(() => vent.endCorrection_m.set(k)),
  };
}
