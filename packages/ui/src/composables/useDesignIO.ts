/**
 * Design file I/O — import a .wdr/.json, export the driver (.wdr) or design (.json),
 * copy a share link, and the About text. Extracted from AppHeader so every shell's
 * chrome (modern header, classic toolbar) reuses ONE implementation — no duplication.
 */
import { state, driverRaw, driverJSON, getDriverModel, setDriverFromWdr, setDriverFromSerialized } from '../store.js';
import { serialize, stateToUrl } from '../utils/persist.js';
import { flash } from '../utils/flash.js';

function dlFile(name: string, text: string, mime: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
}

export function useDesignIO() {
  function shareLink(): void {
    const url = stateToUrl(serialize(state, driverJSON.value, state.compare));
    try { history.replaceState(null, '', url); } catch { /* replaceState can throw on some file:// origins — non-fatal */ }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Share link copied to clipboard'),
        () => prompt('Copy this share link:', url));
    } else { prompt('Copy this share link:', url); }
  }

  function exportDesign(): void {
    const text = JSON.stringify(serialize(state, driverJSON.value, state.compare), null, 2);
    dlFile('design.openisd.json', text, 'application/json');
  }

  function exportWdr(): void {
    const fn = (driverRaw.value.name || 'driver').replace(/[^\w.-]+/g, '_') + '.wdr';
    // The ADT's own toWdr is lossless — carried fields + live ParState provenance.
    dlFile(fn, getDriverModel().toWdr(), 'text/plain');
  }

  /** Load a driver/design from a picked File (.wdr or an OpenISD .json project). */
  function importFile(f: File): void {
    const rd = new FileReader();
    const isWdr = /\.wdr$/i.test(f.name);
    rd.onload = () => {
      const text = rd.result as string;
      try {
        if (isWdr || /^\s*\[Driver\]/.test(text)) {
          setDriverFromWdr(text);
        } else {
          const o = JSON.parse(text);
          if (o.driver) setDriverFromSerialized(o.driver);
          if (o.box) state.box = o.box;
          if (o.P) Object.assign(state.P, o.P);
          if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
        }
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err as Error).message); }
    };
    rd.readAsText(f);
  }

  function about(): void {
    alert(`OpenISD — open loudspeaker enclosure simulator\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
  }

  return { shareLink, exportDesign, exportWdr, importFile, about };
}
