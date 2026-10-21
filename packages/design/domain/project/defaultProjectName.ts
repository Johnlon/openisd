import type {BoxType} from '../../engine/index.js';

/** The box type as a new project's name says it: WinISD's Box tab label, in lower case. */
function boxTypeWords(boxType: BoxType): string {
  switch (boxType) {
    case 'sealed': return 'closed';
    case 'vented': return 'vented';
    case 'box-passive-radiator': return 'passive radiator';
    case 'bandpass4': return '4th order bandpass';
    case 'bandpass6': return '6th order bandpass';
    case 'abc': return 'ABC';
  }
}

/**
 * A new project's name until the person types one: "<driver model> <box type>", e.g.
 * "W5-1138SMF vented" (John, 2026-10-21: "Please default the project name to the driver and box
 * type"). Just the box type when the driver has no model.
 */
export function defaultProjectName(driverModel: string, boxType: BoxType): string {
  const model = driverModel.trim();
  const words = boxTypeWords(boxType);
  return model === '' ? words : `${model} ${words}`;
}
