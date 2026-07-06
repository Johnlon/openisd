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

function toggleProjectOverlay(checkbox) {
  const overlay = document.getElementById('trace-ported');
  if (overlay) overlay.style.display = checkbox.checked ? 'block' : 'none';
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
  document.getElementById('curve-standard').style.display = isIso ? 'none' : 'block';
  document.getElementById('curve-isobarik').style.display = isIso ? 'block' : 'none';
}

function setEnclosureType(type) {
  const label = document.getElementById('nav-enclosure-label');
  const panes = { sealed: 'Sealed', ported: 'Vents', pr: 'Passive Radiator' };
  label.textContent = panes[type];
  document.getElementById('box-type-heading').textContent =
    type === 'pr' ? 'passive radiator' : (type === 'ported' ? 'ported' : 'sealed');
  ['sealed', 'ported', 'pr'].forEach(t => {
    const pane = document.getElementById('enclosure-' + t);
    if (pane) pane.style.display = (t === type) ? 'block' : 'none';
  });
}

const filterFieldSets = {
  'Allpass': ['order', 'q', 'delay'],
  'DLP Raised Cosine': ['centerfreq', 'gain', 'bandwidth'],
  'Highpass': ['subtype', 'order', 'q', 'cutoff'],
  'Lowpass': ['subtype', 'order', 'q', 'cutoff'],
  'Linkwitz transform': ['f0', 'fp', 'q0', 'qp'],
  'Parametric EQ': ['centerfreq2', 'gain2', 'q2'],
  'Peaking 2nd order highpass': ['peakmag', 'peakfreq'],
  'Static gain': ['gain3'],
};

function setFilterType(type) {
  document.querySelectorAll('#filter-editor-fields [data-field]').forEach(el => el.style.display = 'none');
  (filterFieldSets[type] || []).forEach(f => {
    const el = document.querySelector('#filter-editor-fields [data-field="' + f + '"]');
    if (el) el.style.display = 'flex';
  });
}

function openFilterEditor(prefillType) {
  editingFilterRow = null;
  const select = document.getElementById('filter-type-select');
  select.value = prefillType || 'Lowpass';
  setFilterType(select.value);
  openModal('modal-filter-editor');
}

function selectFilterRow(row) {
  document.querySelectorAll('.filter-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
}

function fieldVal(name) {
  const el = document.querySelector('#filter-editor-fields [data-field="' + name + '"] input');
  return el ? el.value : '';
}
function fieldSelectVal(name) {
  const el = document.querySelector('#filter-editor-fields [data-field="' + name + '"] select');
  return el ? el.value : '';
}

function buildFilterSummary() {
  const type = document.getElementById('filter-type-select').value;
  switch (type) {
    case 'Allpass':
      return `Allpass (n=${fieldVal('order')}, Q=${fieldVal('q')})`;
    case 'DLP Raised Cosine':
      return `DLP Raised Cosine (fc=${fieldVal('centerfreq')} Hz, gain=${fieldVal('gain')} dB)`;
    case 'Highpass':
    case 'Lowpass':
      return `${type} (${fieldSelectVal('subtype')}, n=${fieldVal('order')}, fc=${fieldVal('cutoff')} Hz)`;
    case 'Linkwitz transform':
      return `Linkwitz transform (f0=${fieldVal('f0')} Hz, fp=${fieldVal('fp')} Hz)`;
    case 'Parametric EQ':
      return `Parametric EQ (fc=${fieldVal('centerfreq2')} Hz, gain=${fieldVal('gain2')} dB, Q=${fieldVal('q2')})`;
    case 'Peaking 2nd order highpass':
      return `Peaking 2nd order highpass (fc=${fieldVal('peakfreq')} Hz, gain=${fieldVal('peakmag')} dB)`;
    case 'Static gain':
      return `Static gain (${fieldVal('gain3')} dB)`;
    default:
      return type;
  }
}

let editingFilterRow = null;

function addFilterFromEditor() {
  const summary = buildFilterSummary();
  if (editingFilterRow) {
    editingFilterRow.querySelector('span').textContent = summary;
    editingFilterRow = null;
  } else {
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.setAttribute('onclick', 'selectFilterRow(this)');
    row.innerHTML = '<input type="checkbox" checked onclick="event.stopPropagation()"><span>' + summary + '</span>';
    document.getElementById('filters-list').appendChild(row);
    selectFilterRow(row);
  }
  closeModal('modal-filter-editor');
}

function modifySelectedFilterRow() {
  const row = document.querySelector('.filter-row.selected');
  if (!row) return;
  editingFilterRow = row;
  const text = row.querySelector('span').textContent;
  const type = text.split(' (')[0];
  const select = document.getElementById('filter-type-select');
  if ([...select.options].some(o => o.value === type)) select.value = type;
  setFilterType(select.value);
  openModal('modal-filter-editor');
}

function deleteSelectedFilterRow() {
  const row = document.querySelector('.filter-row.selected');
  if (row) row.remove();
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
  document.getElementById('tune-save-row').style.display = 'none';
  // Fake/decorative — a real build would write this into a My Drivers store.
}
function tuneSaveCancel() {
  document.getElementById('tune-save-row').style.display = 'none';
}

const colorPalette = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];
let colorIndex = 0;
function cycleColor(btn) {
  colorIndex = (colorIndex + 1) % colorPalette.length;
  btn.style.background = colorPalette[colorIndex];
}

// Driver editor Reset/Clear: snapshot the modal's pristine markup on load so
// Reset can restore it exactly (values + ParState colors + active tab),
// distinct from Clear which just blanks every field.
let driverEditorSnapshot = null;
function clearDriverEditor() {
  const body = document.querySelector('#modal-driver-editor .modal-body');
  body.querySelectorAll('input[type=text], input[type=number]').forEach(el => el.value = '');
  body.querySelectorAll('textarea').forEach(el => el.value = '');
  body.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
}
function resetDriverEditor() {
  const body = document.querySelector('#modal-driver-editor .modal-body');
  if (driverEditorSnapshot) body.innerHTML = driverEditorSnapshot;
}

// Fake, decorative cursor readout — not a real chart engine, just moves the numbers on click.
document.addEventListener('DOMContentLoaded', () => {
  driverEditorSnapshot = document.querySelector('#modal-driver-editor .modal-body').innerHTML;

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
