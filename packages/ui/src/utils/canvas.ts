import type { PlotData, Geo, DragRange } from '../types.js';

export const fmtF   = (f: number): string => f >= 1000 ? (f/1000).toFixed(f < 10000 ? 2 : 1) + 'k' : f.toFixed(0);
export const fmtY   = (v: number): string => { const a = Math.abs(v); if (a >= 1000) return (v/1000).toFixed(1)+'k'; if (a >= 10) return v.toFixed(0); if (a >= 1) return v.toFixed(1); return v.toFixed(2); };
export const fmtVal = (v: number, u: string): string => { if (!isFinite(v)) return '—'; const a = Math.abs(v); return v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2) + ' ' + u; };

export function niceTicks(min: number, max: number, n = 6): number[] {
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag, step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10, s = step * mag;
  const t: number[] = [];
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) t.push(+v.toFixed(6));
  return t;
}

export function logTicks(min: number, max: number): number[] {
  const t: number[] = [];
  for (let d = Math.floor(Math.log10(min)); d <= Math.ceil(Math.log10(max)); d++)
    for (const mul of [1, 2, 5]) { const v = mul * Math.pow(10, d); if (v >= min && v <= max) t.push(v); }
  return t;
}

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

  const m = { l:44, r:10, t:18, b:20 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const f0 = plotData.fmin || 10, f1 = plotData.fmax || 1000;
  const lx0 = Math.log10(f0), lx1 = Math.log10(f1);
  const { ymin, ymax, logy } = plotData;
  const ly0 = logy ? Math.log10(ymin) : ymin, ly1 = logy ? Math.log10(ymax) : ymax;
  const X = (f: number) => m.l + (Math.log10(f) - lx0) / (lx1 - lx0) * pw;
  const Y = (v: number) => { const vv = logy ? Math.log10(v) : v; return m.t + (1 - (vv - ly0) / (ly1 - ly0)) * ph; };

  // frequency grid
  ctx.strokeStyle = '#243040'; ctx.fillStyle = '#7c8a9c'; ctx.font = '9px Segoe UI'; ctx.lineWidth = 1;
  for (let dec = Math.floor(lx0); dec <= Math.ceil(lx1); dec++)
    for (const mul of [1,2,3,4,5,6,7,8,9]) {
      const f = mul * Math.pow(10, dec); if (f < f0 || f > f1) continue;
      const x = X(f); ctx.globalAlpha = mul === 1 ? 0.85 : 0.28;
      ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke();
      if (mul === 1 || mul === 2 || mul === 5) { ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillText(fmtF(f), x, m.t + ph + 11); }
    }
  ctx.globalAlpha = 1;

  // y grid
  const yt = logy ? logTicks(ymin, ymax) : niceTicks(ymin, ymax, 5);
  ctx.textAlign = 'right';
  for (const v of yt) {
    const y = Y(v); if (y < m.t - 1 || y > m.t + ph + 1) continue;
    ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillText(fmtY(v), m.l - 5, y + 3);
  }

  // series
  const PE_LIMIT_COLOR = '#ffb454';
  for (const s of plotData.series) {
    if (s.phantom) continue;
    ctx.lineWidth = s.dash ? 1.1 : 1.7;
    if (s.dash) ctx.setLineDash([5, 4]); else ctx.setLineDash([]);
    if (s.xlim) {
      // Two-pass: Xmax-limited (design color) then Pe-limited (amber)
      for (const [isXlim, passColor] of [[true, s.color], [false, PE_LIMIT_COLOR]] as const) {
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
    ctx.font = '9px Segoe UI'; ctx.textAlign = 'left';
    const lh = 13, lx = m.l + 6;
    let ly = m.t + 6;
    for (const s of namedSeries) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.dash ? 1.1 : 1.7;
      if (s.dash) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(lx, ly + 3); ctx.lineTo(lx + 14, ly + 3); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = s.color; ctx.fillText(s.name, lx + 17, ly + 6);
      ly += lh;
    }
  }

  const geo: Geo = { m, pw, ph, X, Y, f0, f1 };

  // drag range — shaded band between two frequencies with measurement readout
  if (dragRange) {
    const x1 = X(Math.max(dragRange.fLo, f0)), x2 = X(Math.min(dragRange.fHi, f1));
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x1, m.t, x2 - x1, ph);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x1, m.t); ctx.lineTo(x1, m.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, m.t); ctx.lineTo(x2, m.t + ph); ctx.stroke();
    ctx.setLineDash([]);
    if (readEl) {
      const ff = (f: number) => f >= 100 ? f.toFixed(0) : f.toFixed(1);
      const u = plotData.unit;
      const st = dragRange.stats;
      let html = `<b>${ff(dragRange.fLo)} Hz</b> – <b>${ff(dragRange.fHi)} Hz</b>`;
      if (st) {
        html += `  ripple <b>${st.ripple.toFixed(1)} ${u}</b>`;
        html += `<br>peak <b>${st.peak.toFixed(1)} ${u}</b>  trough <b>${st.trough.toFixed(1)} ${u}</b>  Δ <b>${st.ripple.toFixed(1)} ${u}</b>`;
      }
      readEl.innerHTML = html; readEl.style.display = 'block';
    }
  }

  // crosshair
  if (cursorF && plotData.series[0]) {
    const s0 = plotData.series[0]; let bi = 0, bd = 1e9;
    for (let i = 0; i < s0.xs.length; i++) { const dd = Math.abs(Math.log10(s0.xs[i]) - Math.log10(cursorF)); if (dd < bd) { bd = dd; bi = i; } }
    const fx = s0.xs[bi];
    ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(fx), m.t); ctx.lineTo(X(fx), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    let html = `<b>${fx.toFixed(fx < 100 ? 1 : 0)}Hz</b>`;
    for (const s of plotData.series) {
      if (s.dash || s.phantom) continue;
      const y = s.ys[bi];
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(fx), Y(y), 2.6, 0, 7); ctx.fill();
      html += ` <span style="color:${s.color}">${fmtVal(y, plotData.unit)}</span>`;
    }
    if (readEl) { readEl.innerHTML = html; readEl.style.display = 'block'; }
  } else if (readEl && !dragRange) {
    readEl.style.display = 'none';
  }

  return geo;
}
