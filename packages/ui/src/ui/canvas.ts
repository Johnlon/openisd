import type {PlotData} from '@openisd/design/chart';
import type {DragRange, Geo} from '../types.js';

// Returns geo so the caller can map pixel → frequency for crosshair.
export function drawOne(
  canvas: HTMLCanvasElement | null,
  plotData: PlotData | null,
  cursorF: number | null,
  readEl: HTMLElement | null,
  dragRange: DragRange | null,
): Geo | null {
  if (!canvas || !plotData) return null;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 300, H = canvas.clientHeight || 180;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Chart colours are read from CSS custom properties on the canvas (inherited from the
  // app root), so the chart follows the palette with no fork.
  const cs = getComputedStyle(canvas);
  const cvar = (name: string, fallback: string) => (cs.getPropertyValue(name).trim() || fallback);
  const COL = {
    grid:     cvar('--chart-grid', '#243040'),
    text:     cvar('--chart-text', '#7c8a9c'),
    cross:    cvar('--chart-cross', '#ffffff55'),
    band:     cvar('--chart-band', 'rgba(255,255,255,0.07)'),
    bandLine: cvar('--chart-band-line', 'rgba(255,255,255,0.35)'),
    // A DIFFERENT custom property from the app's own `--chart-bg` (used elsewhere for the
    // .gpanel div's background, and inherited by every canvas — reading THAT one here would
    // make every render see a non-empty value and always fillRect, even with no user override).
    // `--chart-bg-override` is only ever set inline on the canvas by GraphPanel.vue when the
    // user has actually picked one in Options → Plot Window → Colors, so it stays empty (no
    // fillRect, transparent canvas as today) until then.
    bg:       cvar('--chart-bg-override', ''),
    // The amber trace used for the Pe(power)-limited segment of an Xmax/Pe-split curve — the
    // one hardcoded chart-line color left in this file, and the closest OpenISD equivalent to
    // WinISD's "Xmax limit" Options swatch (see OptionsModal.vue header comment: WinISD's own
    // Xmax-limited segment reuses the trace's own per-project color, not a single constant, so
    // this override customizes the Pe-limited tint, not literally an "Xmax-limited" tint).
    peLimit:  cvar('--chart-pelimit', '#ffb454'),
  };
  if (COL.bg) { ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H); }

  const m = { l:44, r:10, t:18, b:20 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const { freqAxis, levelAxis } = plotData;
  const X = (f: number) => m.l + freqAxis.fraction(f) * pw;
  const Y = (v: number) => m.t + (1 - levelAxis.fraction(v)) * ph;

  // frequency grid
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.text; ctx.font = '9px Inter'; ctx.lineWidth = 1;
  for (const line of freqAxis.gridLines()) {
    const x = X(line.f); ctx.globalAlpha = line.major ? 0.85 : 0.28;
    ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke();
    if (line.labelled) { ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillText(freqAxis.tickLabel(line.f), x, m.t + ph + 11); }
  }
  ctx.globalAlpha = 1;

  // y grid
  ctx.textAlign = 'right';
  for (const tick of levelAxis.ticks(ph)) {
    const y = Y(tick.value); if (y < m.t - 1 || y > m.t + ph + 1) continue;
    const isMajor = tick.major;

    if (isMajor) {
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.1;
    } else {
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 0.8;
    }

    ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();

    if (tick.labelled) {
      ctx.globalAlpha = isMajor ? 1.0 : 0.45;
      ctx.fillText(levelAxis.tickLabel(tick.value), m.l - 5, y + 3);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  // series
  for (const s of plotData.series) {
    if (s.phantom) continue;
    // The focused project's own trace, drawn heavier so it reads apart from compare overlays.
    ctx.lineWidth = s.dash ? 1.1 : (s.current ? 2.6 : 1.7);
    if (s.dash) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
    if (s.xlim) {
      // Two-pass: Xmax-limited (design color) then Pe-limited (amber)
      for (const [isXlim, passColor] of [[true, s.color], [false, COL.peLimit]] as const) {
        ctx.strokeStyle = passColor;
        ctx.beginPath(); let started = false;
        for (let i = 0; i < s.xs.length; i++) {
          if (s.xlim[i] !== isXlim) { started = false; continue; }
          const y = Y(s.ys[i]); if (!isFinite(y)) { started = false; continue; }
          if (!started) { ctx.moveTo(X(s.xs[i]), y); started = true; } else ctx.lineTo(X(s.xs[i]), y);
        }
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = s.color;
      ctx.beginPath(); let started = false;
      for (let i = 0; i < s.xs.length; i++) {
        const y = Y(s.ys[i]); if (!isFinite(y)) { started = false; continue; }
        if (!started) { ctx.moveTo(X(s.xs[i]), y); started = true; } else ctx.lineTo(X(s.xs[i]), y);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // legend — only when there are multiple named series
  const namedSeries = plotData.series.filter(s => s.name);
  if (namedSeries.length > 1) {
    ctx.font = '9px Inter'; ctx.textAlign = 'left';
    const lh = 13, lx = m.l + 6;
    let ly = m.t + 6;
    for (const s of namedSeries) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.dash ? 1.1 : (s.current ? 2.6 : 1.7);
      if (s.dash) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(lx, ly + 3); ctx.lineTo(lx + 14, ly + 3); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = s.current ? 'bold 9px Inter' : '9px Inter';
      ctx.fillStyle = s.color; ctx.fillText(s.name, lx + 17, ly + 6);
      ly += lh;
    }
  }

  const geo: Geo = { m, pw, ph, X, Y, axis: freqAxis };

  // drag range — shaded band between two frequencies with measurement readout
  if (dragRange) {
    const band = freqAxis.clampBand(dragRange.fLo, dragRange.fHi);
    const x1 = X(band.lo), x2 = X(band.hi);
    ctx.fillStyle = COL.band;
    ctx.fillRect(x1, m.t, x2 - x1, ph);
    ctx.strokeStyle = COL.bandLine; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x1, m.t); ctx.lineTo(x1, m.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, m.t); ctx.lineTo(x2, m.t + ph); ctx.stroke();
    // level lines — where the current design's curve crosses EACH selection cursor
    const prim = plotData.series.find(s => s.current) ?? plotData.series.find(s => !s.dash && !s.phantom);
    if (prim && prim.xs.length) {
      for (const f of [dragRange.fLo, dragRange.fHi]) {
        const y = Y(prim.ys[freqAxis.nearestIndex(prim.xs, f)]);
        if (!isFinite(y) || y < m.t || y > m.t + ph) continue;
        ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    if (readEl) {
      const u = plotData.unit;
      const st = dragRange.stats;
      let html = `<b>${freqAxis.bandLabel(dragRange.fLo)} Hz</b> – <b>${freqAxis.bandLabel(dragRange.fHi)} Hz</b>`;
      if (st) {
        html += `  Δ <b>${levelAxis.statLabel(st.ripple)} ${u}</b>`;
        html += `<br>peak <b>${levelAxis.statLabel(st.peak)} ${u}</b>  trough <b>${levelAxis.statLabel(st.trough)} ${u}</b>`;
      }
      readEl.innerHTML = html; readEl.style.display = 'block';
    }
  }

  // crosshair
  const s0 = plotData.series.find(s => s.current) ?? plotData.series[0];
  const bi = cursorF && s0 ? freqAxis.crosshairIndex(s0.xs, cursorF) : null;
  if (bi !== null && s0) {
    const fx = s0.xs[bi];
    ctx.strokeStyle = COL.cross; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(fx), m.t); ctx.lineTo(X(fx), m.t + ph); ctx.stroke();
    // level line — where the current design's curve crosses the cursor frequency
    const prim = plotData.series.find(s => s.current) ?? plotData.series.find(s => !s.dash && !s.phantom);
    if (prim) {
      const py = Y(prim.ys[bi]);
      if (isFinite(py) && py >= m.t && py <= m.t + ph) {
        ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    let html = `<b>${freqAxis.cursorLabel(fx)}Hz</b>`;
    for (const s of plotData.series) {
      if (s.dash || s.phantom) continue;
      const y = s.ys[bi];
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(fx), Y(y), 2.6, 0, 7); ctx.fill();
      html += ` <span style="color:${s.color}">${levelAxis.readout(y, plotData.unit)}</span>`;
    }
    if (readEl) { readEl.innerHTML = html; readEl.style.display = 'block'; }
  } else if (readEl && !dragRange) {
    readEl.style.display = 'none';
  }

  return geo;
}
