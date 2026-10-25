// Turns a baseline name such as "desktop-wizard-abc-step3" into words John can read:
// "Desktop, New project wizard, ABC box, step 3". Names come from packages/ui/test/visual/screens.ts
// (skin, then the screen name). A name that matches no pattern comes back unchanged, with a warning.
const SKINS = {desktop: 'Desktop', mobile: 'Phone'};
const BOX_TYPES = {
  sealed: 'sealed',
  vented: 'vented',
  'box-passive-radiator': 'passive radiator',
  bandpass4: '4th order bandpass',
  bandpass6: '6th order bandpass',
  abc: 'ABC',
};
const upper = word => word.charAt(0).toUpperCase() + word.slice(1);

// The screen after the skin, in words; null when the pattern is unknown.
function screenWords(skin, rest) {
  if (rest === 'empty') return 'no project open';
  if (rest === 'menu') return 'menu';
  let m = /^wizard-(.+)-step(\d)$/.exec(rest);
  if (m && m[1] in BOX_TYPES) {
    const step = Number(m[2]);
    // The box type is chosen on step 3, so steps 1 and 2 do not show one.
    return step < 3 ? `New project wizard, step ${step}` : `New project wizard, ${BOX_TYPES[m[1]]} box, step ${step}`;
  }
  m = /^box-(.+)$/.exec(rest);
  if (m && m[1] in BOX_TYPES) return `${BOX_TYPES[m[1]]} box project`;
  if (skin === 'mobile' && rest === 'tab-enclosure') return 'Box tab, scrolled down to the vents';
  if (skin === 'mobile' && rest === 'tab-advanced') return 'Advanced page';
  m = /^tab-([a-z]+)$/.exec(rest);
  if (m) return `${upper(m[1])} tab`;
  return null;
}

/** Plain words for a baseline name. `warn` is called with a message when the name is not understood. */
export function plainScreenName(name, warn = message => console.error(message)) {
  const m = /^(desktop|mobile)-(.+)$/.exec(name);
  const words = m ? screenWords(m[1], m[2]) : null;
  if (words === null) {
    warn(`screen-names: no plain name for "${name}"; showing it as it is`);
    return name;
  }
  return `${SKINS[m[1]]}, ${words}`;
}
