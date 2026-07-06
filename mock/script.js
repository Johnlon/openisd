// WinISD mock — UI wiring only. No calculations, no persistence.

function showTab(name) {
  document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.project-nav li').forEach(el => el.classList.remove('active'));
  const section = document.getElementById('tab-' + name);
  if (section) section.classList.add('active');
  const navItem = document.querySelector('.project-nav li[data-tab="' + name + '"]');
  if (navItem) navItem.classList.add('active');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showModalTab(modalId, paneName, btn) {
  const modal = document.getElementById(modalId);
  modal.querySelectorAll('.mtab').forEach(el => el.classList.remove('active'));
  modal.querySelectorAll('.modal-pane').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  modal.querySelector('.modal-pane[data-pane="' + paneName + '"]').classList.add('active');
}

function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    if (el.id !== id) el.classList.remove('open');
  });
  document.getElementById(id).classList.toggle('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.chart-select') && !e.target.closest('.tb-btn.has-menu') && !e.target.closest('.dd-menu-anchor')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('open'));
  }
});

function selectChartType(name, el) {
  document.getElementById('chart-name-label').textContent = name;
  document.querySelectorAll('#chart-dropdown .menu-item').forEach(i => i.classList.remove('current'));
  el.classList.add('current');
  // Closing 'open' here would just get re-toggled back open when this click
  // bubbles up to the .chart-select's own onclick=toggleDropdown — let that
  // single bubbled toggle (dropdown is currently open -> closes) be the only
  // thing that touches the 'open' class, same as the other toolbar dropdowns.

  // purely cosmetic: swap to the canned transfer-function graph for that one entry,
  // otherwise fall back to the SPL graph. No real chart engine here.
  const isTransferFn = name === 'Transfer function magnitude';
  document.getElementById('graph-spl').style.display = isTransferFn ? 'none' : 'block';
  document.getElementById('graph-transferfn').style.display = isTransferFn ? 'block' : 'none';
}

// Generalized multi-project chart overlay: every project row carries
// data-project="<id>"; every trace polyline (in every graph svg) that belongs
// to that project carries a matching data-trace-for="<id>". Checking a
// project's box shows all its traces in whichever graph is currently visible;
// unchecking hides them. The "pr" project's SPL traces are further gated by
// the Standard/Iso-Barik placement toggle (only one of the two is shown even
// when the project is checked).
function refreshProjectTraceVisibility() {
  document.querySelectorAll('.project-row').forEach(row => {
    const id = row.dataset.project;
    const checked = row.querySelector('input[type=checkbox]').checked;
    document.querySelectorAll('[data-trace-for="' + id + '"]').forEach(el => {
      if (el.id === 'curve-standard' || el.id === 'curve-isobarik') return; // handled by setPlacement
      el.style.display = checked ? 'block' : 'none';
    });
  });
  const prChecked = document.querySelector('.project-row[data-project="pr"] input[type=checkbox]').checked;
  const isIso = document.querySelector('input[name=placement]:checked').value === 'iso';
  document.getElementById('curve-standard').style.display = (prChecked && !isIso) ? 'block' : 'none';
  document.getElementById('curve-isobarik').style.display = (prChecked && isIso) ? 'block' : 'none';
}

function toggleProjectTrace() {
  refreshProjectTraceVisibility();
}

function selectProjectRow(row) {
  document.querySelectorAll('.project-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
}

function setPlacement(mode) {
  const isIso = mode === 'iso';
  document.getElementById('numdrivers-suffix').textContent = isIso ? 'pairs' : 'driver(s)';
  document.getElementById('wiring-standard').style.display = isIso ? 'none' : 'block';
  document.getElementById('wiring-isobarik').style.display = isIso ? 'block' : 'none';
  refreshProjectTraceVisibility();
}

const ENCLOSURE_TYPES = ['sealed', 'ported', 'pr', 'bp4', 'bp6', 'bp8'];

function setEnclosureType(type) {
  const label = document.getElementById('nav-enclosure-label');
  const panes = {
    sealed: 'Sealed', ported: 'Vents', pr: 'Passive Radiator',
    bp4: '4th Order BP', bp6: '6th Order BP', bp8: 'ABC',
  };
  label.textContent = panes[type];
  const select = document.getElementById('box-type-select');
  if (select) select.value = type;

  const isDual = type === 'bp4' || type === 'bp6' || type === 'bp8';
  document.getElementById('box-single-chamber').style.display = isDual ? 'none' : 'block';
  document.getElementById('box-dual-chamber').style.display = isDual ? 'block' : 'none';
  if (isDual) {
    const headings = { bp4: '4th Order Bandpass', bp6: '6th Order Bandpass', bp8: '8th Order Bandpass — ABC (Aperiodic Bi-Chamber)' };
    document.getElementById('box-dual-heading').textContent = headings[type];
    document.getElementById('box-chamber1-heading').textContent = (type === 'bp4') ? 'Chamber 1 (sealed)' : 'Chamber 1 (vented)';
    document.getElementById('box-chamber1-fh-row').style.display = (type === 'bp4') ? 'none' : 'flex';
    document.getElementById('box-diagram-abc').style.display = (type === 'bp8') ? 'block' : 'none';
    document.getElementById('box-diagram-generic').style.display = (type === 'bp8') ? 'none' : 'block';
  }

  ENCLOSURE_TYPES.forEach(t => {
    const pane = document.getElementById('enclosure-' + t);
    if (pane) pane.style.display = (t === type) ? 'block' : 'none';
  });
}

// Inline, reactive filter rows — no popup editor. Each quick-add button drops
// in a fully expanded row for its filter type, built from this per-type field
// list; every field is a spin-field so it stacks with the exponential-accel
// spinner behaviour, and edits recompute that row's own summary line live.
const filterFieldDefs = {
  'Allpass': [
    { key: 'order', label: 'Order', value: '2.000' },
    { key: 'q', label: 'Q', value: '0.707' },
    { key: 'delay', label: 'Delay time', value: '0.001', unit: 's', ug: 'time' },
  ],
  'DLP Raised Cosine': [
    { key: 'centerfreq', label: 'Center freq', value: '100.000', unit: 'Hz', ug: 'freq' },
    { key: 'gain', label: 'Gain', value: '6.000', unit: 'dB' },
    { key: 'bandwidth', label: 'Bandwidth', value: '0.333', unit: 'oct' },
  ],
  'Highpass': [
    { key: 'subtype', label: 'Subtype', select: ['Butterworth', 'Linkwitz-Riley (4th order only)', 'Bessel', 'SOS, User specified fc and Q'] },
    { key: 'order', label: 'Order', value: '2.000' },
    { key: 'q', label: 'Q', value: '0.707' },
    { key: 'cutoff', label: 'Cutoff', value: '50.000', unit: 'Hz', ug: 'freq' },
  ],
  'Lowpass': [
    { key: 'subtype', label: 'Subtype', select: ['Butterworth', 'Linkwitz-Riley (4th order only)', 'Bessel', 'SOS, User specified fc and Q'] },
    { key: 'order', label: 'Order', value: '2.000' },
    { key: 'q', label: 'Q', value: '0.707' },
    { key: 'cutoff', label: 'Cutoff', value: '50.000', unit: 'Hz', ug: 'freq' },
  ],
  'Linkwitz transform': [
    { key: 'f0', label: 'f0', value: '50.000', unit: 'Hz', ug: 'freq' },
    { key: 'fp', label: 'fp', value: '20.000', unit: 'Hz', ug: 'freq' },
    { key: 'q0', label: 'Q0', value: '0.707' },
    { key: 'qp', label: 'Qp', value: '0.707' },
  ],
  'Parametric EQ': [
    { key: 'centerfreq2', label: 'Center freq', value: '30.000', unit: 'Hz', ug: 'freq' },
    { key: 'gain2', label: 'Gain', value: '6.000', unit: 'dB' },
    { key: 'q2', label: 'Q', value: '2.000' },
  ],
  'Peaking 2nd order highpass': [
    { key: 'peakmag', label: 'Peak mag', value: '6.000', unit: 'dB' },
    { key: 'peakfreq', label: 'Peak freq', value: '20.000', unit: 'Hz', ug: 'freq' },
  ],
  'Static gain': [
    { key: 'gain3', label: 'Gain', value: '0.000', unit: 'dB' },
  ],
};

function renderFilterFieldsHTML(type) {
  return (filterFieldDefs[type] || []).map(f => {
    if (f.select) {
      const opts = f.select.map(o => `<option>${o}</option>`).join('');
      return `<div class="field"><label>${f.label}</label><select class="entered" data-key="${f.key}" onchange="updateFilterSummary(this)">${opts}</select></div>`;
    }
    const unitSpan = f.unit
      ? (f.ug
        ? `<span class="unit unit-cyc" data-ug="${f.ug}" onclick="cycleUnit(this)">${f.unit}</span>`
        : `<span class="unit">${f.unit}</span>`)
      : '';
    return `<div class="field"><label>${f.label}</label><input type="text" class="entered spin-field" data-key="${f.key}" value="${f.value}" oninput="updateFilterSummary(this)">${unitSpan}</div>`;
  }).join('');
}

function buildFilterSummaryFromRow(row) {
  const type = row.dataset.type;
  const val = (key) => {
    const el = row.querySelector('[data-key="' + key + '"]');
    return el ? el.value : '';
  };
  switch (type) {
    case 'Allpass':
      return `Allpass (n=${val('order')}, Q=${val('q')})`;
    case 'DLP Raised Cosine':
      return `DLP Raised Cosine (fc=${val('centerfreq')} Hz, gain=${val('gain')} dB)`;
    case 'Highpass':
    case 'Lowpass':
      return `${type} (${val('subtype')}, n=${val('order')}, fc=${val('cutoff')} Hz)`;
    case 'Linkwitz transform':
      return `Linkwitz transform (f0=${val('f0')} Hz, fp=${val('fp')} Hz)`;
    case 'Parametric EQ':
      return `Parametric EQ (fc=${val('centerfreq2')} Hz, gain=${val('gain2')} dB, Q=${val('q2')})`;
    case 'Peaking 2nd order highpass':
      return `Peaking 2nd order highpass (fc=${val('peakfreq')} Hz, gain=${val('peakmag')} dB)`;
    case 'Static gain':
      return `Static gain (${val('gain3')} dB)`;
    default:
      return type;
  }
}

function updateFilterSummary(fieldEl) {
  const row = fieldEl.closest('.filter-row-inline');
  if (row) row.querySelector('.filter-summary').textContent = buildFilterSummaryFromRow(row);
}

function quickAddFilter(type) {
  const row = document.createElement('div');
  row.className = 'filter-row-inline expanded';
  row.dataset.type = type;
  row.innerHTML = `
    <div class="filter-row-head" onclick="toggleFilterExpand(this)">
      <input type="checkbox" checked onclick="event.stopPropagation()">
      <span class="filter-type-badge">${type}</span>
      <span class="filter-summary"></span>
      <button class="filter-del" onclick="event.stopPropagation(); removeFilterRow(this)" title="Delete this filter">&#10060;</button>
    </div>
    <div class="filter-row-fields">${renderFilterFieldsHTML(type)}</div>
  `;
  document.getElementById('filters-list').appendChild(row);
  row.querySelector('.filter-summary').textContent = buildFilterSummaryFromRow(row);
  initSpinners(row);
}

function toggleFilterExpand(headEl) {
  headEl.closest('.filter-row-inline').classList.toggle('expanded');
}

function removeFilterRow(btn) {
  btn.closest('.filter-row-inline').remove();
}

function selectPickerRow(row) {
  document.querySelectorAll('.driver-picker-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
  row.querySelector('input[type=radio]').checked = true;
}

function confirmSelectDriver() {
  const row = document.querySelector('.driver-picker-row.selected');
  if (row) {
    document.getElementById('driver-brand-field').value = row.dataset.brand;
    document.getElementById('driver-model-field').value = row.dataset.model;
  }
  closeModal('modal-select-driver');
}

function openTune() {
  document.getElementById('tune-panel').classList.add('open');
  document.getElementById('tune-save-row').style.display = 'none';
}
function closeTune() {
  document.getElementById('tune-panel').classList.remove('open');
}
function tuneReset() {
  document.querySelectorAll('#tune-panel input').forEach(el => {
    el.value = el.getAttribute('data-original');
  });
}
function tuneSaveStart() {
  document.getElementById('tune-save-row').style.display = 'flex';
  document.getElementById('tune-save-name').value = document.getElementById('driver-model-field').value + ' (custom)';
}
function tuneSaveConfirm() {
  const name = document.getElementById('tune-save-name').value.trim();
  document.getElementById('tune-save-row').style.display = 'none';
  if (!name) return;
  const [brand, ...rest] = name.split(' ');
  addMyDriver(brand || 'Custom', rest.join(' ') || name);
}
function tuneSaveCancel() {
  document.getElementById('tune-save-row').style.display = 'none';
}

// ---------------- Manage Drivers (My Drivers, in-memory only — fake/decorative
// persistence is out of scope for this mock; see MOCK_DESIGN.md). ----------------
let myDrivers = [];
let myDriversSeq = 0;
let selectedMyDriverId = null;

function renderMyDrivers() {
  const hint = document.getElementById('mydrivers-empty-hint');
  const table = document.getElementById('mydrivers-table');
  const tbody = document.getElementById('driver-picker-mydrivers');
  if (!tbody) return;
  if (myDrivers.length === 0) {
    hint.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  hint.style.display = 'none';
  table.style.display = '';
  tbody.innerHTML = myDrivers.map(d => `
    <tr class="driver-picker-row${d.id === selectedMyDriverId ? ' selected' : ''}${d.disabled ? ' disabled' : ''}"
        onclick="selectMyDriverRow(this, ${d.id})" data-brand="${d.brand}" data-model="${d.model}">
      <td><input type="radio" name="driverpick" ${d.id === selectedMyDriverId ? 'checked' : ''}></td>
      <td>${d.brand}</td><td>${d.model}${d.disabled ? ' (disabled)' : ''}</td>
      <td>${d.fs}</td><td>${d.vas}</td><td>${d.qts}</td><td>${d.sd}</td><td>${d.re}</td>
    </tr>`).join('');
}

function selectMyDriverRow(row, id) {
  selectedMyDriverId = id;
  document.querySelectorAll('#driver-picker-mydrivers .driver-picker-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
  row.querySelector('input[type=radio]').checked = true;
}

function addMyDriver(brand, model) {
  myDrivers.push({
    id: ++myDriversSeq, brand, model,
    fs: '30.00', vas: '4.80', qts: '0.294', sd: '143.0', re: '3.400',
    disabled: false,
  });
  renderMyDrivers();
}

function customiseToMyDrivers() {
  const brand = document.getElementById('driver-brand-field').value || 'Custom';
  const model = document.getElementById('driver-model-field').value || 'driver';
  addMyDriver(brand, model + ' (custom)');
}

function saveAsNewDriver() {
  const name = window.prompt('Save as new — name for this My Drivers entry:', 'New driver');
  if (!name) return;
  const [brand, ...rest] = name.split(' ');
  addMyDriver(brand || 'Custom', rest.join(' ') || name);
}

function editCustomDriver() {
  if (selectedMyDriverId == null) { window.alert('Select a row in Select Driver → My Drivers first.'); return; }
  const d = myDrivers.find(x => x.id === selectedMyDriverId);
  openDriverEditor('mydrivers', d ? d.brand + ' ' + d.model : '');
}

// Makes explicit, inside the modal itself (not just a tooltip), which of
// three very different things this editor session is touching, and shows
// only the footer buttons that make sense for that context:
//  - 'project': the driver copy embedded in the current project (opened via
//    the Driver tab's Edit button). Edits apply live to the project; Done
//    keeps them; Clone... additionally writes an independent copy to My
//    Drivers; Select Driver swaps in a different driver's values.
//  - 'mydrivers': a My Drivers entry, opened via Manage Drivers -> Edit
//    custom driver. Done/Clone... apply directly to that My Drivers entry;
//    the current project is untouched unless you Select Driver it back in.
//  - 'toolbar': opened via the toolbar icon, standalone — not tied to any
//    project or My Drivers entry. Starts empty; Select Driver or Load driver
//    populate it; Clone detaches from whatever was loaded; Save as to disk /
//    Save to My Drivers persist it; Create Box spins up a new project from it.
const DRIVER_EDITOR_BUTTONS_BY_MODE = {
  project: ['de-btn-done', 'de-btn-clone', 'de-btn-select', 'de-btn-clear', 'de-btn-cancel'],
  mydrivers: ['de-btn-done', 'de-btn-clone', 'de-btn-clear', 'de-btn-cancel'],
  toolbar: ['de-btn-select', 'de-btn-load', 'de-btn-clone-toolbar', 'de-btn-saveas-disk', 'de-btn-save-mydrivers', 'de-btn-createbox', 'de-btn-clear', 'de-btn-cancel'],
};
const ALL_DRIVER_EDITOR_BUTTONS = ['de-btn-done', 'de-btn-clone', 'de-btn-select', 'de-btn-load', 'de-btn-clone-toolbar', 'de-btn-saveas-disk', 'de-btn-save-mydrivers', 'de-btn-createbox', 'de-btn-clear', 'de-btn-cancel'];

let driverEditorMode = 'project';
let driverEditorOpenSnapshot = null;

function openDriverEditor(mode, name) {
  driverEditorMode = mode;
  const hint = document.getElementById('driver-editor-context');
  hint.classList.remove('mydrivers-mode', 'toolbar-mode');
  if (mode === 'mydrivers') {
    hint.textContent = `Editing My Drivers entry "${name}" directly — Done updates this entry; the current project is unaffected unless you re-select it via Select Driver.`;
    hint.classList.add('mydrivers-mode');
  } else if (mode === 'toolbar') {
    hint.textContent = 'Empty editor — use Select Driver or Load driver to bring in a definition, or fill in fields from scratch.';
    hint.classList.add('toolbar-mode');
    clearDriverEditor();
  } else {
    hint.textContent = 'Editing the driver copy embedded in the current project — changes apply live to the project immediately; Done updates this copy.';
  }
  const visible = new Set(DRIVER_EDITOR_BUTTONS_BY_MODE[mode] || DRIVER_EDITOR_BUTTONS_BY_MODE.project);
  ALL_DRIVER_EDITOR_BUTTONS.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = visible.has(id) ? '' : 'none';
  });
  driverEditorOpenSnapshot = document.querySelector('#modal-driver-editor .modal-body').innerHTML;
  openModal('modal-driver-editor');
}

function doneDriverEditor() {
  closeModal('modal-driver-editor');
}

function cancelDriverEditor() {
  const body = document.querySelector('#modal-driver-editor .modal-body');
  if (driverEditorOpenSnapshot) body.innerHTML = driverEditorOpenSnapshot;
  closeModal('modal-driver-editor');
}

function cloneDriverEditor() {
  const brandEl = document.getElementById('de-brand-field');
  const modelEl = document.getElementById('de-model-field');
  const defaultName = `${brandEl.value || 'Custom'} ${modelEl.value ? modelEl.value + ' (custom)' : 'driver'}`.trim();
  const name = window.prompt('Save to My Drivers — name for this entry:', defaultName);
  if (!name) return;
  const [brand, ...rest] = name.split(' ');
  addMyDriver(brand || 'Custom', rest.join(' ') || name);
}

function selectDriverFromEditor() {
  closeModal('modal-driver-editor');
  openModal('modal-select-driver');
}

function loadDriverFromDisk() {
  document.getElementById('de-load-file-input').click();
}

function handleDriverFileLoad(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  const stem = file.name.replace(/\.[^/.]+$/, '');
  const [brand, ...rest] = stem.split(/[\s_-]+/);
  document.getElementById('de-brand-field').value = brand || 'Loaded';
  document.getElementById('de-model-field').value = rest.join(' ') || stem;
  window.alert(`Loaded "${file.name}" (mock — Brand/Model seeded from the filename only; contents are not actually parsed).`);
}

function cloneDetachEditor() {
  const modelEl = document.getElementById('de-model-field');
  modelEl.value = modelEl.value ? modelEl.value + ' (clone)' : 'Untitled (clone)';
  document.getElementById('driver-editor-context').textContent =
    'Editing a detached clone — not linked back to any loaded driver. Use Save as to disk or Save to My Drivers to keep it.';
}

function saveDriverAsToDisk() {
  const brand = document.getElementById('de-brand-field').value || 'Custom';
  const model = document.getElementById('de-model-field').value || 'driver';
  const lines = [`Brand: ${brand}`, `Model: ${model}`];
  document.querySelectorAll('#modal-driver-editor .modal-pane[data-pane="parameters"] .pg-label').forEach(label => {
    const input = label.nextElementSibling;
    if (input) lines.push(`${label.textContent}: ${input.value}`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${brand}_${model}.wdr.txt`.replace(/\s+/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}

let createBoxSeq = 0;
function createBoxFromEditor() {
  const brand = document.getElementById('de-brand-field').value || 'Custom';
  const model = document.getElementById('de-model-field').value || 'driver';
  const id = 'custom' + (++createBoxSeq);
  const row = document.createElement('div');
  row.className = 'project-row';
  row.dataset.project = id;
  row.setAttribute('onclick', 'selectProjectRow(this)');
  row.innerHTML = `<input type="checkbox" checked onclick="event.stopPropagation(); toggleProjectTrace(this)"><span>New Project (${brand} ${model})</span>`;
  document.querySelector('.projects-list').appendChild(row);
  selectProjectRow(row);
  closeModal('modal-driver-editor');
}

function deleteCustomDriver() {
  if (selectedMyDriverId == null) { window.alert('Select a row in Select Driver → My Drivers first.'); return; }
  myDrivers = myDrivers.filter(d => d.id !== selectedMyDriverId);
  selectedMyDriverId = null;
  renderMyDrivers();
}

function disableCustomDriver() {
  if (selectedMyDriverId == null) { window.alert('Select a row in Select Driver → My Drivers first.'); return; }
  const d = myDrivers.find(d => d.id === selectedMyDriverId);
  if (d) d.disabled = !d.disabled;
  renderMyDrivers();
}

// ---------------- Clickable unit labels: fake/decorative — cycles the unit
// text only, never converts the adjacent numeric value (this mock is
// logic-free), same as every other field here. ----------------
const UNIT_SETS = {
  length: ['m', 'cm', 'mm', 'in', 'ft'],
  volume: ['l', 'cm³', 'in³', 'ft³'],
  area: ['cm²', 'm²', 'in²'],
  mass: ['kg', 'g', 'lb', 'oz'],
  freq: ['Hz', 'kHz'],
  angle: ['rad', 'deg'],
  pressure: ['Pa', 'atm', 'psi'],
  temp: ['K', '°C', '°F'],
  time: ['s', 'ms'],
};

function cycleUnit(el) {
  const set = UNIT_SETS[el.dataset.ug];
  if (!set) return;
  const idx = set.indexOf(el.textContent.trim());
  el.textContent = set[(idx + 1 + set.length) % set.length];
}

// ---------------- Exponential-accel spinners: attached to every input with
// class "spin-field" (reactive what-if fields only — never added to one-shot
// modals like Driver Editor/Options where there's nothing to react to). Holding
// the button repeats the step with a shrinking interval, so it accelerates
// the longer you hold, instead of a flat repeat rate. ----------------
function stepDecimals(value) {
  const s = String(value);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

function wrapSpinner(input) {
  if (input.closest('.spin-wrap')) return;
  const wrap = document.createElement('span');
  wrap.className = 'spin-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const arrows = document.createElement('span');
  arrows.className = 'spin-arrows';
  arrows.innerHTML = '<button type="button" class="spin-btn spin-up" tabindex="-1">&#9650;</button><button type="button" class="spin-btn spin-down" tabindex="-1">&#9660;</button>';
  wrap.appendChild(arrows);

  const step = (dir) => {
    const decimals = Math.max(2, stepDecimals(input.value));
    const delta = dir * Math.pow(10, -decimals);
    const next = (parseFloat(input.value) || 0) + delta;
    input.value = next.toFixed(decimals);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const startHold = (dir) => {
    step(dir);
    let delay = 400;
    const tick = () => {
      step(dir);
      delay = Math.max(35, delay * 0.82);
      holdTimer = setTimeout(tick, delay);
    };
    let holdTimer = setTimeout(tick, delay);
    const stop = () => {
      clearTimeout(holdTimer);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('mouseleave', stop);
    };
    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);
  };

  arrows.querySelector('.spin-up').addEventListener('mousedown', (e) => { e.preventDefault(); startHold(1); });
  arrows.querySelector('.spin-down').addEventListener('mousedown', (e) => { e.preventDefault(); startHold(-1); });
}

function initSpinners(root) {
  (root || document).querySelectorAll('input.spin-field').forEach(wrapSpinner);
}

const colorPalette = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];
let colorIndex = 0;
function cycleColor(btn) {
  colorIndex = (colorIndex + 1) % colorPalette.length;
  btn.style.background = colorPalette[colorIndex];
}

// Clear: blanks every field to default (empty) values. Cancel (not Clear)
// is what reverts to the values the editor had when it was opened this
// time — see cancelDriverEditor()/driverEditorOpenSnapshot above.
function clearDriverEditor() {
  const body = document.querySelector('#modal-driver-editor .modal-body');
  body.querySelectorAll('input[type=text], input[type=number]').forEach(el => el.value = '');
  body.querySelectorAll('textarea').forEach(el => el.value = '');
  body.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
}

// Fake, decorative cursor readout — not a real chart engine, just moves the numbers on click.
document.addEventListener('DOMContentLoaded', () => {
  quickAddFilter('Lowpass');
  initSpinners(document);
  refreshProjectTraceVisibility();

  document.querySelectorAll('.graph-wrap').forEach(wrap => {
    wrap.addEventListener('click', (e) => {
      const rect = wrap.getBoundingClientRect();
      const fx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const fy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const freq = Math.round((10 * Math.pow(50, fx)) * 100) / 100;
      const db = Math.round((102 - fy * 60) * 1000) / 1000;
      const readout = document.getElementById('cursor-readout');
      if (readout) readout.innerHTML = freq.toFixed(2) + ' Hz<br>' + db.toFixed(3) + ' dB';
    });
  });
});
