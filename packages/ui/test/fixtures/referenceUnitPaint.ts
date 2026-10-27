import {approvedUnits} from './approvedPaintReference.js';
import type {Page} from '@playwright/test';
/** Frozen reference paint, independent of application classes, style sheets and tokens. */
export function measureUnitPaint(element: Element) {
  const view = element.ownerDocument.defaultView;
  if (view === null) throw new Error('Unit paint requires a live document');
  const css = view.getComputedStyle(element), box = element.getBoundingClientRect();
  const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'textDecorationLine', 'textDecorationStyle', 'textDecorationColor', 'textDecorationThickness', 'textUnderlineOffset'] as const;
  return {width: box.width, height: box.height, ...Object.fromEntries(properties.map(key => [key, css[key]]))};
}
export async function referenceUnitPaint(_page:Page,skin='mobile',screen='tab-box'){
 const units=approvedUnits(skin,screen);
 const fixed=approvedUnits('mobile','tab-signal').find(unit=>!unit.toggle);
 const toggle=approvedUnits('mobile','tab-box').find(unit=>unit.toggle);
 if(!fixed||!toggle)throw new Error('Approved units need fixed and switchable examples');
 return {fixed:fixed.paint,toggle:toggle.paint,gap:-Number(toggle.paint.width),units};
}
