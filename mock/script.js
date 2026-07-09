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

const ENCLOSURE_TYPES = ['sealed', 'ported', 'pr', 'bp4', 'bp6', 'abc'];

// Per-box-type chamber field labels, matching the WinISD box panels.
// Single-chamber types: the 2nd field's label, and whether a Qtc row shows.
const SINGLE_CHAMBER_FIELDS = {
  sealed: { f2: 'Fsc', qtc: true },
  ported: { f2: 'Tuning freq', qtc: false },
  pr: { f2: 'Fh', qtc: false },
};
// Dual-chamber types: the Rear and Front chambers' 2nd-field labels.
const DUAL_CHAMBER_FIELDS = {
  bp4: { rear: 'Frc', front: 'Tuning freq' },
  bp6: { rear: 'Tuning freq', front: 'Tuning freq' },
  abc: { rear: 'Tuning freq', front: 'Tuning freq' },
};

// Storage for the Box tab's chamber Volume field(s) — the one field per
// group (single vs dual chamber) that's a *shared* DOM input relabelled
// between types, rather than each type having its own dedicated element
// (like every other per-type panel in the app already does). Without this,
// switching sealed -> ported -> sealed silently clobbers the Volume you'd
// entered for sealed, because it's the same <input> the whole time. Holding
// one entry per type here, keyed on the DOM ids above, is what lets the app
// keep several box types' params around at once with only one active.
const enclosureFieldState = {
  sealed: { volume: '6.00' },
  ported: { volume: '6.00' },
  pr: { volume: '6.00' },
  bp4: { rearVolume: '8.00', frontVolume: '10.00' },
  bp6: { rearVolume: '8.00', frontVolume: '10.00' },
  abc: { rearVolume: '8.00', frontVolume: '10.00' },
};
let activeEnclosureType = null;

function setEnclosureType(type) {
  // Snapshot the outgoing type's live Volume field(s) before repainting —
  // must happen before any DOM values below are overwritten.
  if (activeEnclosureType && activeEnclosureType !== type) {
    const wasDual = activeEnclosureType === 'bp4' || activeEnclosureType === 'bp6' || activeEnclosureType === 'abc';
    if (wasDual) {
      enclosureFieldState[activeEnclosureType].rearVolume = document.getElementById('box-rear-volume-field').value;
      enclosureFieldState[activeEnclosureType].frontVolume = document.getElementById('box-front-volume-field').value;
    } else {
      enclosureFieldState[activeEnclosureType].volume = document.getElementById('box-single-volume-field').value;
    }
  }
  activeEnclosureType = type;

  const label = document.getElementById('nav-enclosure-label');
  const panes = {
    sealed: 'Closed', ported: 'Vented', pr: 'Passive Radiator',
    bp4: '4th Order BP', bp6: '6th Order BP', abc: 'ABC',
  };
  label.textContent = panes[type];
  const select = document.getElementById('box-type-select');
  if (select) select.value = type;

  const isDual = type === 'bp4' || type === 'bp6' || type === 'abc';
  document.getElementById('box-single-chamber').style.display = isDual ? 'none' : 'block';
  document.getElementById('box-dual-chamber').style.display = isDual ? 'block' : 'none';

  ['box-diagram-sealed', 'box-diagram-ported', 'box-diagram-pr'].forEach(id => {
    document.getElementById(id).style.display = (id === 'box-diagram-' + type) ? 'block' : 'none';
  });

  if (!isDual) {
    const cfg = SINGLE_CHAMBER_FIELDS[type];
    document.getElementById('box-single-f2-label').textContent = cfg.f2;
    document.getElementById('box-single-qtc-row').style.display = cfg.qtc ? 'flex' : 'none';
  } else {
    const cfg = DUAL_CHAMBER_FIELDS[type];
    document.getElementById('box-rear-f2-label').textContent = cfg.rear;
    document.getElementById('box-front-f2-label').textContent = cfg.front;
    ['box-diagram-bp4', 'box-diagram-bp6', 'box-diagram-abc'].forEach(id => {
      document.getElementById(id).style.display = (id === 'box-diagram-' + type) ? 'block' : 'none';
    });
    document.getElementById('box-abc-hint').style.display = (type === 'abc') ? 'block' : 'none';
  }

  ENCLOSURE_TYPES.forEach(t => {
    const pane = document.getElementById('enclosure-' + t);
    if (pane) pane.style.display = (t === type) ? 'block' : 'none';
  });

  // Restore the incoming type's own stored Volume field(s) — the
  // counterpart to the snapshot above, so switching back to a type you'd
  // already edited shows what you left it at, not the previous type's value.
  if (isDual) {
    document.getElementById('box-rear-volume-field').value = enclosureFieldState[type].rearVolume;
    document.getElementById('box-front-volume-field').value = enclosureFieldState[type].frontVolume;
  } else {
    document.getElementById('box-single-volume-field').value = enclosureFieldState[type].volume;
  }
}

// FILTER_LABEL is the single source of each field's label, so the SAME wording
// appears in both the Filter Editor panel and the list summary — e.g. "Order (n)"
// reads identically in both, with the conventional symbol in parentheses instead
// of a separate shorthand that the two views could drift apart on.
const FILTER_LABEL = {
  subtype: 'Subtype',
  order: 'Order (n)',
  q: 'Q',
  cutoff: 'Cutoff (fc)',
  delay: 'Delay time (t)',
  centerfreq: 'Center freq (fc)',
  gain: 'Gain',
  bandwidth: 'Bandwidth',
  f0: 'f0', fp: 'fp', q0: 'Q0', qp: 'Qp',
  centerfreq2: 'Center freq (fc)',
  gain2: 'Gain',
  q2: 'Q',
  peakmag: 'Peak mag',
  peakfreq: 'Peak freq (fc)',
  gain3: 'Gain',
};

const FILTER_SUBTYPES = ['Butterworth', 'Linkwitz-Riley (4th order only)', 'Bessel', 'SOS, User specified fc and Q'];

// Per-type field lists: `key` is the value key on row._filter, `label` comes from
// FILTER_LABEL, `value` is the default, and `unit`/`ug` drive the unit suffix +
// unit-cycling. Used both to build the editor and to seed default values.
const filterFieldDefs = {
  'Allpass': [
    { key: 'order', label: FILTER_LABEL.order, value: '2.000' },
    { key: 'q', label: FILTER_LABEL.q, value: '0.707' },
    { key: 'delay', label: FILTER_LABEL.delay, value: '0.001', unit: 's', ug: 'time' },
  ],
  'DLP Raised Cosine': [
    { key: 'centerfreq', label: FILTER_LABEL.centerfreq, value: '100.000', unit: 'Hz', ug: 'freq' },
    { key: 'gain', label: FILTER_LABEL.gain, value: '6.000', unit: 'dB' },
    { key: 'bandwidth', label: FILTER_LABEL.bandwidth, value: '0.333', unit: 'oct' },
  ],
  'Highpass': [
    { key: 'subtype', label: FILTER_LABEL.subtype, select: FILTER_SUBTYPES },
    { key: 'order', label: FILTER_LABEL.order, value: '2.000' },
    { key: 'q', label: FILTER_LABEL.q, value: '0.707' },
    { key: 'cutoff', label: FILTER_LABEL.cutoff, value: '50.000', unit: 'Hz', ug: 'freq' },
  ],
  'Lowpass': [
    { key: 'subtype', label: FILTER_LABEL.subtype, select: FILTER_SUBTYPES },
    { key: 'order', label: FILTER_LABEL.order, value: '2.000' },
    { key: 'q', label: FILTER_LABEL.q, value: '0.707' },
    { key: 'cutoff', label: FILTER_LABEL.cutoff, value: '50.000', unit: 'Hz', ug: 'freq' },
  ],
  'Linkwitz transform': [
    { key: 'f0', label: FILTER_LABEL.f0, value: '50.000', unit: 'Hz', ug: 'freq' },
    { key: 'fp', label: FILTER_LABEL.fp, value: '20.000', unit: 'Hz', ug: 'freq' },
    { key: 'q0', label: FILTER_LABEL.q0, value: '0.707' },
    { key: 'qp', label: FILTER_LABEL.qp, value: '0.707' },
  ],
  'Parametric EQ': [
    { key: 'centerfreq2', label: FILTER_LABEL.centerfreq2, value: '30.000', unit: 'Hz', ug: 'freq' },
    { key: 'gain2', label: FILTER_LABEL.gain2, value: '6.000', unit: 'dB' },
    { key: 'q2', label: FILTER_LABEL.q2, value: '2.000' },
  ],
  'Peaking 2nd order highpass': [
    { key: 'peakmag', label: FILTER_LABEL.peakmag, value: '6.000', unit: 'dB' },
    { key: 'peakfreq', label: FILTER_LABEL.peakfreq, value: '20.000', unit: 'Hz', ug: 'freq' },
  ],
  'Static gain': [
    { key: 'gain3', label: FILTER_LABEL.gain3, value: '0.000', unit: 'dB' },
  ],
};

// The filter LIST shows summary-only rows — one scannable line each. Each row
// holds its own value object (row._filter); editing happens in the docked,
// non-modal Filter Editor panel, per the document/transaction model documented
// in MOCK_DESIGN.md. The list is the document view; the editor is a transaction
// on top of it (Cancel discards, Done commits and marks the project unsaved).

function defaultFilterValues(type) {
  const vals = { _enabled: true };
  (filterFieldDefs[type] || []).forEach(f => {
    vals[f.key] = f.select ? f.select[0] : f.value;
  });
  return vals;
}

// Detail portion only — the type name is the row's bold badge, so repeating it
// here would double it up. Labels come from FILTER_LABEL, identical to the editor
// field labels. Q is listed only for the user-specified-SOS subtype, matching the
// supplied WinISD screenshot where Butterworth shows no Q and "User SOS" does.
function filterSummaryText(type, vals) {
  const v = (k) => vals[k] ?? '';
  const L = FILTER_LABEL;
  switch (type) {
    case 'Allpass': return `${L.order}=${v('order')}, ${L.q}=${v('q')}, ${L.delay}=${v('delay')} s`;
    case 'DLP Raised Cosine': return `${L.centerfreq}=${v('centerfreq')} Hz, ${L.gain}=${v('gain')} dB`;
    case 'Highpass':
    case 'Lowpass': {
      const sub = v('subtype');
      const base = `${sub}, ${L.order}=${v('order')}, ${L.cutoff}=${v('cutoff')} Hz`;
      return sub === 'SOS, User specified fc and Q' ? `${base}, ${L.q}=${v('q')}` : base;
    }
    case 'Linkwitz transform': return `${L.f0}=${v('f0')} Hz, ${L.fp}=${v('fp')} Hz`;
    case 'Parametric EQ': return `${L.centerfreq2}=${v('centerfreq2')} Hz, ${L.gain2}=${v('gain2')} dB, ${L.q2}=${v('q2')}`;
    case 'Peaking 2nd order highpass': return `${L.peakfreq}=${v('peakfreq')} Hz, ${L.peakmag}=${v('peakmag')} dB`;
    case 'Static gain': return `${L.gain3}=${v('gain3')} dB`;
    default: return '';
  }
}

function addFilterRow(type, vals) {
  const row = document.createElement('div');
  row.className = 'filter-row-inline';
  row.dataset.type = type;
  row._filter = vals || defaultFilterValues(type);
  row.innerHTML = `
    <div class="filter-row-head" onclick="openFilterEditor(this.closest('.filter-row-inline'))" title="Click to edit this filter">
      <input type="checkbox" ${row._filter._enabled ? 'checked' : ''} onclick="event.stopPropagation(); toggleFilterEnabled(this)" title="Enable / bypass this filter">
      <span class="filter-type-badge">${type}</span>
      <span class="filter-summary"></span>
      <span class="filter-edit-hint" title="Click the row to edit">&#9998;</span>
      <button class="filter-del" onclick="event.stopPropagation(); removeFilterRow(this)" title="Delete this filter">&#10060;</button>
    </div>`;
  document.getElementById('filters-list').appendChild(row);
  refreshFilterRow(row);
  return row;
}

function refreshFilterRow(row) {
  row.querySelector('.filter-summary').textContent = filterSummaryText(row.dataset.type, row._filter);
  row.classList.toggle('filter-disabled', !row._filter._enabled);
}

function toggleFilterEnabled(cb) {
  const row = cb.closest('.filter-row-inline');
  row._filter._enabled = cb.checked;
  refreshFilterRow(row);
  markProjectModified();   // a direct document edit (outside the editor transaction)
}

function removeFilterRow(btn) {
  btn.closest('.filter-row-inline').remove();
  markProjectModified();
}

// Add drops a new default row and immediately opens it for editing; Cancel on
// that first edit removes the row again (nothing committed), Done keeps it.
function quickAddFilter(type) {
  const row = addFilterRow(type);
  openFilterEditor(row, true);
}

// ---- Docked Filter Editor: a non-modal transaction on the selected filter ----
let filterEditRow = null;      // the row being edited
let filterEditSnapshot = null; // its values at open (the Working layer), restored on Cancel
let filterEditIsNew = false;   // opened straight from Add?
let filterEditDirtyBefore = false; // dirty state of Working at open — restored on Cancel

function openFilterEditor(row, isNew) {
  // Only one docked panel at a time: if Tune is open, drop its Temp layer
  // (restoring its pre-open dirtiness) BEFORE we snapshot ours below.
  if (document.getElementById('tune-panel').classList.contains('open')) tuneCancel();
  filterEditRow = row;
  filterEditIsNew = !!isNew;
  filterEditSnapshot = { ...row._filter };
  filterEditDirtyBefore = projectModified;   // remember Working's dirtiness beneath this Temp layer
  document.getElementById('filter-editor-type').textContent = row.dataset.type;
  renderFilterEditor();
  document.getElementById('filter-editor').classList.add('open');
  document.querySelectorAll('#filters-list .filter-row-inline.editing').forEach(r => r.classList.remove('editing'));
  row.classList.add('editing');
}

// Subtype-aware field set for Lowpass/Highpass. ⚠ Inference (NOT verified
// against WinISD): Q is a free field only for user-specified SOS, and order is
// fixed at 4 for Linkwitz-Riley ("4th order only") so it shows read-only. The
// Butterworth-vs-SOS Q difference itself IS grounded in the WinISD screenshot.
function filterEditorDefs(type, vals) {
  if (type !== 'Lowpass' && type !== 'Highpass') return filterFieldDefs[type] || [];
  const sub = vals.subtype || 'Butterworth';
  const lr = sub === 'Linkwitz-Riley (4th order only)';
  const sos = sub === 'SOS, User specified fc and Q';
  const defs = [{ key: 'subtype', label: FILTER_LABEL.subtype, select: FILTER_SUBTYPES, subtypeChange: true }];
  defs.push({ key: 'order', label: FILTER_LABEL.order, locked: lr });
  if (sos) defs.push({ key: 'q', label: FILTER_LABEL.q });
  defs.push({ key: 'cutoff', label: FILTER_LABEL.cutoff, unit: 'Hz', ug: 'freq' });
  return defs;
}

function renderFilterEditor() {
  const type = filterEditRow.dataset.type;
  const vals = filterEditRow._filter;
  const body = document.getElementById('filter-editor-body');
  body.innerHTML = filterEditorDefs(type, vals).map(def => {
    const cur = vals[def.key] ?? (def.select ? def.select[0] : (def.value ?? ''));
    if (def.select) {
      const opts = def.select.map(o => `<option${o === cur ? ' selected' : ''}>${o}</option>`).join('');
      const handler = def.subtypeChange ? 'onFilterSubtypeChange(this)' : 'onFilterEditorInput()';
      return `<div class="field"><label>${def.label}</label><select class="entered" data-key="${def.key}" onchange="${handler}">${opts}</select></div>`;
    }
    const unit = def.unit ? (def.ug
      ? `<span class="unit unit-cyc" data-ug="${def.ug}" onclick="cycleUnit(this)">${def.unit}</span>`
      : `<span class="unit">${def.unit}</span>`) : '';
    const cls = def.locked ? 'calculated greyed' : 'entered spin-field';
    const lock = def.locked ? 'readonly' : '';
    return `<div class="field"><label>${def.label}</label><input type="text" class="${cls}" data-key="${def.key}" value="${cur}" ${lock} oninput="onFilterEditorInput()">${unit}</div>`;
  }).join('');
  initSpinners(body);
}

function syncFilterEditor() {
  const vals = filterEditRow._filter;
  document.querySelectorAll('#filter-editor-body [data-key]').forEach(el => {
    vals[el.dataset.key] = el.value;
  });
}

function onFilterEditorInput() {
  syncFilterEditor();
  refreshFilterRow(filterEditRow);  // live preview on the list behind the panel
  markProjectModified();            // Temp is the active layer → dirty (yellow) live
}

function onFilterSubtypeChange() {
  syncFilterEditor();
  if (filterEditRow._filter.subtype === 'Linkwitz-Riley (4th order only)') {
    filterEditRow._filter.order = '4.000';
  }
  renderFilterEditor();             // reshape the fields for the new subtype
  refreshFilterRow(filterEditRow);
  markProjectModified();
}

function filterEditorDone() {
  syncFilterEditor();
  refreshFilterRow(filterEditRow);
  markProjectModified();            // commit → the document is now unsaved
  closeFilterEditor();
}

function filterEditorCancel() {
  if (filterEditIsNew) {
    filterEditRow.remove();         // discard the just-added filter, nothing committed
  } else {
    filterEditRow._filter = filterEditSnapshot;   // restore the Working-layer values
    refreshFilterRow(filterEditRow);
  }
  // Drop the Temp layer: Working becomes active again with the dirtiness it had
  // before this popup opened — so a Cancel clears yellow only if this popup was
  // the sole contributor, and leaves it set if other edits are still outstanding.
  projectModified = filterEditDirtyBefore;
  updateUnsavedIndicator();
  closeFilterEditor();
}

function closeFilterEditor() {
  document.getElementById('filter-editor').classList.remove('open');
  if (filterEditRow) filterEditRow.classList.remove('editing');
  filterEditRow = null;
  filterEditSnapshot = null;
  filterEditIsNew = false;
}

function selectPickerRow(row) {
  document.querySelectorAll('.driver-picker-row').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
  row.querySelector('input[type=radio]').checked = true;
}

// Opened directly from the Driver tab, Select Driver activates the pick into
// the project immediately (that's the whole point of that button). Opened
// from inside the Driver Editor, it must NOT activate anything yet — the
// pick only lands in the editor's own fields for review, and only becomes
// the project's actual driver if the user then presses Done.
let selectDriverSource = 'project';

function confirmSelectDriver() {
  const row = document.querySelector('.driver-picker-row.selected');
  if (row) {
    if (selectDriverSource === 'editor') {
      document.getElementById('de-brand-field').value = row.dataset.brand;
      document.getElementById('de-model-field').value = row.dataset.model;
    } else {
      document.getElementById('driver-brand-field').value = row.dataset.brand;
      document.getElementById('driver-model-field').value = row.dataset.model;
      markProjectModified();
    }
  }
  closeModal('modal-select-driver');
  returnToDriverEditorIfNeeded();
}

function cancelSelectDriver() {
  closeModal('modal-select-driver');
  returnToDriverEditorIfNeeded();
}

function returnToDriverEditorIfNeeded() {
  if (selectDriverSource === 'editor') {
    document.getElementById('modal-driver-editor').classList.add('open');
  }
  selectDriverSource = 'project';
}

// ---------------- Driver library browser (toolbar entry point) ----------------
// WinISD's own toolbar has exactly one driver-related icon, and it's just a
// Load/Save/Save-As editor with no library concept at all. OpenISD adds a real
// personal driver library ("My Drivers") on top of that, so the toolbar icon
// opens this same Select-Driver modal in a third, standalone mode — browsing
// only, no project is affected — with its own action row for Import/Export/
// Customise/Edit/Delete/Disable. The Driver tab's own "Select Driver" and the
// Driver Editor's own "Select Driver" keep their existing modes unchanged.
function resetSelectDriverModalChrome() {
  document.getElementById('driver-library-actions').style.display = 'none';
  document.querySelector('#modal-select-driver .footer-buttons .ok-btn').style.display = '';
}

function openSelectDriverForProject() {
  selectDriverSource = 'project';
  resetSelectDriverModalChrome();
  openModal('modal-select-driver');
}

function openDriverLibrary() {
  selectDriverSource = 'library';
  document.getElementById('driver-library-actions').style.display = 'flex';
  document.querySelector('#modal-select-driver .footer-buttons .ok-btn').style.display = 'none';
  openModal('modal-select-driver');
}

function newDriverFromLibrary() {
  closeModal('modal-select-driver');
  openDriverEditor('toolbar');
}

function loadDriverIntoLibrary() {
  document.getElementById('library-load-file-input').click();
}

// Import always lands in My Drivers, never directly on a project — and is
// lossless regardless of source format (.openisd-driver.yml or .wdr), since
// OpenISD's driver model is a strict superset of WDR's. Only Export is lossy.
function handleLibraryDriverLoad(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  const stem = file.name.replace(/\.[^/.]+$/, '').replace(/\.openisd-driver$/, '');
  const [brand, ...rest] = stem.split(/[\s_-]+/);
  addMyDriver(brand || 'Imported', rest.join(' ') || stem);
  window.alert(`Imported "${file.name}" into My Drivers (mock — Brand/Model seeded from the filename only; contents are not actually parsed).`);
}

function selectedDriverPickerRow() {
  return document.querySelector('#modal-select-driver .modal-pane.active .driver-picker-row.selected');
}

// The lossy direction — a real .wdr can't hold everything OpenISD's own
// driver model can, so this (not Load/Import) is where fidelity is lost.
function exportSelectedDriverWdr() {
  const row = selectedDriverPickerRow();
  if (!row) { window.alert('Select a driver row first.'); return; }
  const brand = row.dataset.brand, model = row.dataset.model;
  downloadText(`${brand}_${model}.wdr.txt`.replace(/\s+/g, '_'), `Brand: ${brand}\nModel: ${model}`);
}

function customiseSelectedLibraryDriver() {
  const row = document.querySelector('#driver-picker-library .driver-picker-row.selected');
  if (!row) { window.alert('Select a driver in the Library tab first.'); return; }
  addMyDriver(row.dataset.brand, row.dataset.model + ' (custom)');
  const myDriversTab = document.querySelectorAll('#modal-select-driver .mtab')[1];
  showModalTab('modal-select-driver', 'mydrivers', myDriversTab);
}

function editSelectedLibraryDriver() {
  if (selectedMyDriverId != null) {
    closeModal('modal-select-driver');
    editCustomDriver();
  } else {
    window.alert("Built-in Library drivers are shipped data and can't be edited directly — use Customise to create an editable My Drivers copy first.");
  }
}

// Tune is a Temp layer over Working, same model as the Filter Editor: open
// snapshots the field values + Working's dirtiness, Done keeps the live edits,
// Cancel drops the layer (restore values + pre-open dirtiness).
let tuneDirtyBefore = false;

function openTune() {
  if (filterEditRow) filterEditorCancel();   // drop any open filter Temp layer first
  document.getElementById('tune-panel').classList.add('open');
  document.getElementById('tune-save-row').style.display = 'none';
  tuneDirtyBefore = projectModified;
  document.querySelectorAll('#tune-panel input').forEach(el => { el._tuneSnap = el.value; });
}
// Done keeps the live edits (already applied to Working) and closes.
function tuneDone() {
  closeTune();
}
// Cancel restores the field values captured at open and Working's pre-open
// dirtiness — so yellow clears only if Tune was the sole contributor — then closes.
function tuneCancel() {
  document.querySelectorAll('#tune-panel input').forEach(el => {
    if (el._tuneSnap !== undefined) el.value = el._tuneSnap;
  });
  projectModified = tuneDirtyBefore;
  updateUnsavedIndicator();
  closeTune();
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

// ---------------- Unsaved-changes indicator ----------------
// Nothing is permanently saved for the current project until Save Changes
// (browser storage) or Save as file (physical disk) is hit — everything
// else (Tune's live edits, Edit's Done, a direct Select Driver) only ever
// updates the in-memory project state, same as the volatile-WPR-storage
// answer in MOCK_DESIGN.md. This tracks that gap and surfaces it in the
// legend bar at the top of the content panel.
let projectModified = false;

function updateUnsavedIndicator() {
  document.getElementById('unsaved-label').style.display = projectModified ? 'flex' : 'none';
  document.getElementById('btn-save-changes').classList.toggle('dirty', projectModified);
  document.getElementById('btn-revert').classList.toggle('dirty', projectModified);
}

function markProjectModified() {
  projectModified = true;
  updateUnsavedIndicator();
}

function clearProjectModified() {
  projectModified = false;
  updateUnsavedIndicator();
}

// The project's "last saved" state — what Revert restores to. Only
// Save Changes (and, implicitly, page load) ever update this snapshot;
// Save as file is just an export and deliberately does not touch it.
function captureProjectSnapshot() {
  return {
    brand: document.getElementById('driver-brand-field').value,
    model: document.getElementById('driver-model-field').value,
    tune: Array.from(document.querySelectorAll('#tune-panel .tune-fld:not(.tune-ro) input')).map(i => i.value),
  };
}
let lastSavedSnapshot = null;

function saveProjectChangesLocal() {
  // Fake/decorative — a real build would persist the project's live state
  // (driver, box, filters, ...) to localStorage/IndexedDB here.
  lastSavedSnapshot = captureProjectSnapshot();
  clearProjectModified();
}

function revertProjectChanges() {
  if (!lastSavedSnapshot) return;
  document.getElementById('driver-brand-field').value = lastSavedSnapshot.brand;
  document.getElementById('driver-model-field').value = lastSavedSnapshot.model;
  document.querySelectorAll('#tune-panel .tune-fld:not(.tune-ro) input').forEach((input, i) => {
    if (lastSavedSnapshot.tune[i] !== undefined) input.value = lastSavedSnapshot.tune[i];
  });
  clearProjectModified();
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// The full in-memory model, OpenISD's own lossless shape — every stored
// enclosure type (see enclosureFieldState above), not just the active one.
// Still a mock: hand-built YAML text, not a real YAML library, and Filters/
// Signal/Advanced aren't tracked in JS state yet so they're not included.
function buildProjectYaml() {
  const brand = document.getElementById('driver-brand-field').value || 'Custom';
  const model = document.getElementById('driver-model-field').value || 'driver';
  const lines = ['kind: project', 'driver:', `  brand: ${brand}`, `  model: ${model}`,
    `activeEnclosureType: ${activeEnclosureType}`, 'enclosures:'];
  ENCLOSURE_TYPES.forEach(t => {
    lines.push(`  ${t}:`);
    Object.entries(enclosureFieldState[t]).forEach(([k, v]) => lines.push(`    ${k}: ${v}`));
  });
  lines.push('tune:');
  document.querySelectorAll('#tune-panel .tune-fld:not(.tune-ro) input').forEach(input => {
    const label = input.closest('.tune-fld').querySelector('label').textContent.replace('opt', '').trim();
    lines.push(`  ${label}: ${input.value}`);
  });
  return lines.join('\n') + '\n';
}

function projectFilenameStem() {
  const brand = document.getElementById('driver-brand-field').value || 'Custom';
  const model = document.getElementById('driver-model-field').value || 'driver';
  return `${brand}_${model}`.replace(/\s+/g, '_');
}

// Toolbar Save: quick save to OpenISD's own format. Deliberately does NOT
// clear the browser-local dirty flag (btn-save-changes/btn-revert) — that
// pair tracks a *different* persistence layer (localStorage autosave) with
// no WinISD equivalent; disk Save and browser Save Changes are independent.
function saveProjectNative() {
  downloadText(`${projectFilenameStem()}.openisd.yml`, buildProjectYaml(), 'text/yaml');
}

function saveProjectNativeAs() {
  const chosen = window.prompt('Save project as:', `${projectFilenameStem()}.openisd.yml`);
  if (!chosen) return;
  const filename = chosen.endsWith('.openisd.yml') ? chosen : chosen + '.openisd.yml';
  downloadText(filename, buildProjectYaml(), 'text/yaml');
}

// Save All: every row in the Projects list. Mock limitation, stated in the
// file rather than hidden — this is a single-document prototype, so only
// whichever project is currently selected has real live-edited state;
// the other row(s) were never loaded this session and have nothing to dump.
function saveAllProjects() {
  const liveId = document.querySelector('.project-row.selected')?.dataset.project;
  document.querySelectorAll('.project-row').forEach(row => {
    const name = row.querySelector('span').textContent.trim().replace(/\s+/g, '_');
    if (row.dataset.project === liveId) {
      downloadText(`${name}.openisd.yml`, buildProjectYaml(), 'text/yaml');
    } else {
      downloadText(`${name}.openisd.yml`,
        `kind: project\n# mock limitation: only the selected project's fields are tracked in\n# this single-document prototype — "${row.querySelector('span').textContent.trim()}"\n# was never loaded this session, so there is nothing real to serialize.\n`,
        'text/yaml');
    }
  });
}

// ---------------- New Project wizard ----------------
// Box type and starting Volume are both quick, skippable defaults-setting
// steps (Next always works, unedited or not); picking a real driver is the
// one mandatory step, since a box design is meaningless without T/S params
// to tune around — so it isn't a third wizard pane, it's a hand-off to the
// same Select-Driver picker the Driver tab's own "Select Driver" uses,
// rather than duplicating that table/search UI a third time in this app.
let newProjectWizardStep = 1;
let newProjectBoxType = 'sealed';
// Which type the Volume field(s) currently hold values *for* — lets Next
// only reset to that type's defaults the first time it's shown, not every
// time Next is pressed, so Back -> Next (box type unchanged) doesn't wipe
// out a Volume the user already edited on step 2.
let npwVolumesForType = null;

function startNewProjectWizard() {
  if (projectModified && !window.confirm('Discard unsaved changes and start a new project?')) return;
  newProjectBoxType = 'sealed';
  npwVolumesForType = null;
  document.getElementById('npw-boxtype-select').value = 'sealed';
  npwSyncVolumeVisibility('sealed');
  showNewProjectWizardStep(1);
  openModal('modal-new-project');
}

function npwBoxTypeChanged(type) {
  newProjectBoxType = type;
}

function npwSyncVolumeVisibility(type) {
  const isDual = type === 'bp4' || type === 'bp6' || type === 'abc';
  document.getElementById('npw-volume-single').style.display = isDual ? 'none' : 'flex';
  document.getElementById('npw-volume-dual').style.display = isDual ? 'block' : 'none';
}

function npwResetVolumeDefaultsForType(type) {
  const isDual = type === 'bp4' || type === 'bp6' || type === 'abc';
  const defaults = ENCLOSURE_FIELD_DEFAULTS[type];
  if (isDual) {
    document.getElementById('npw-rear-volume').value = defaults.rearVolume;
    document.getElementById('npw-front-volume').value = defaults.frontVolume;
  } else {
    document.getElementById('npw-volume').value = defaults.volume;
  }
  npwVolumesForType = type;
}

function showNewProjectWizardStep(n) {
  newProjectWizardStep = n;
  document.getElementById('npw-step-1').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('npw-step-2').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('npw-step-indicator').textContent =
    n === 1 ? 'Step 1 of 2 — Box type' : 'Step 2 of 2 — Starting volume';
  document.getElementById('npw-btn-back').style.display = n > 1 ? '' : 'none';
  document.getElementById('npw-btn-next').textContent = n === 2 ? 'Next: Pick Driver >' : 'Next >';
}

function npwNext() {
  if (newProjectWizardStep === 1) {
    npwSyncVolumeVisibility(newProjectBoxType);
    if (newProjectBoxType !== npwVolumesForType) npwResetVolumeDefaultsForType(newProjectBoxType);
    showNewProjectWizardStep(2);
  } else {
    npwFinishToDriver();
  }
}

function npwBack() {
  showNewProjectWizardStep(1);
}

// Resets every stored box type to its default (not just the chosen one —
// otherwise New would leave stale edits sitting in enclosureFieldState for
// the next project to inherit), applies this wizard's Box-type + starting
// Volume choices on top, then opens the driver picker. activeEnclosureType
// is nulled first so setEnclosureType() skips its usual snapshot-the-
// outgoing-type step — this is a discard, not a switch.
function npwFinishToDriver() {
  closeModal('modal-new-project');
  activeEnclosureType = null;
  ENCLOSURE_TYPES.forEach(t => { enclosureFieldState[t] = JSON.parse(JSON.stringify(ENCLOSURE_FIELD_DEFAULTS[t])); });
  const isDual = newProjectBoxType === 'bp4' || newProjectBoxType === 'bp6' || newProjectBoxType === 'abc';
  if (isDual) {
    enclosureFieldState[newProjectBoxType].rearVolume = document.getElementById('npw-rear-volume').value;
    enclosureFieldState[newProjectBoxType].frontVolume = document.getElementById('npw-front-volume').value;
  } else {
    enclosureFieldState[newProjectBoxType].volume = document.getElementById('npw-volume').value;
  }
  document.getElementById('driver-brand-field').value = 'Custom';
  document.getElementById('driver-model-field').value = 'driver';
  setEnclosureType(newProjectBoxType);
  clearProjectModified();
  lastSavedSnapshot = captureProjectSnapshot();
  openSelectDriverForProject();
}

// Export WPR — the lossy, WinISD-compatible direction. Confirmed against the
// real .wpr corpus (WINISD_WPR_FILE_SCHEMA.md): one [Box] section, one
// BType, per file — so only the *active* enclosure type round-trips. Any
// other type this project has edited values for is silently dropped by the
// format itself; warn before writing, naming exactly which types are lost.
const ENCLOSURE_FIELD_DEFAULTS = JSON.parse(JSON.stringify(enclosureFieldState));
function exportProjectWpr() {
  const editedOtherTypes = ENCLOSURE_TYPES.filter(t => t !== activeEnclosureType &&
    JSON.stringify(enclosureFieldState[t]) !== JSON.stringify(ENCLOSURE_FIELD_DEFAULTS[t]));
  if (editedOtherTypes.length > 0) {
    const proceed = window.confirm(
      `WPR only keeps the active box type (${activeEnclosureType}). This project also ` +
      `has edited values for: ${editedOtherTypes.join(', ')} — those will be lost. Export anyway?`
    );
    if (!proceed) return;
  }
  const brand = document.getElementById('driver-brand-field').value || 'Custom';
  const model = document.getElementById('driver-model-field').value || 'driver';
  const lines = [`Brand: ${brand}`, `Model: ${model}`];
  document.querySelectorAll('#tune-panel .tune-fld:not(.tune-ro) input').forEach(input => {
    const label = input.closest('.tune-fld').querySelector('label').textContent.replace('opt', '').trim();
    lines.push(`${label}: ${input.value}`);
  });
  downloadText(`${projectFilenameStem()}.wpr.txt`, lines.join('\n'));
  // Deliberately does NOT clear the browser-local dirty flag — exporting a
  // file is not the same as saving; only Save Changes / Revert do that.
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
  toolbar: ['de-btn-select', 'de-btn-load', 'de-btn-clone-toolbar', 'de-btn-save-native', 'de-btn-saveas-disk', 'de-btn-save-mydrivers', 'de-btn-createbox', 'de-btn-clear', 'de-btn-cancel'],
};
const ALL_DRIVER_EDITOR_BUTTONS = ['de-btn-done', 'de-btn-clone', 'de-btn-select', 'de-btn-load', 'de-btn-clone-toolbar', 'de-btn-save-native', 'de-btn-saveas-disk', 'de-btn-save-mydrivers', 'de-btn-createbox', 'de-btn-clear', 'de-btn-cancel'];

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
    hint.textContent = 'Editing the driver copy embedded in the current project.';
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
  const brand = document.getElementById('de-brand-field').value;
  const model = document.getElementById('de-model-field').value;
  if (driverEditorMode === 'project') {
    document.getElementById('driver-brand-field').value = brand;
    document.getElementById('driver-model-field').value = model;
    markProjectModified();
  } else if (driverEditorMode === 'mydrivers' && selectedMyDriverId != null) {
    const d = myDrivers.find(x => x.id === selectedMyDriverId);
    if (d) {
      d.brand = brand || d.brand;
      d.model = model || d.model;
      renderMyDrivers();
    }
  }
  closeModal('modal-driver-editor');
}

function cancelDriverEditor() {
  const body = document.querySelector('#modal-driver-editor .modal-body');
  if (driverEditorOpenSnapshot) body.innerHTML = driverEditorOpenSnapshot;
  closeModal('modal-driver-editor');
}

// Integrated inline naming row (not a native window.prompt) — same in-place
// pattern as the Tune panel's own "Save to My Drivers" flow.
function cloneDriverEditor() {
  const brandEl = document.getElementById('de-brand-field');
  const modelEl = document.getElementById('de-model-field');
  const defaultName = `${brandEl.value || 'Custom'} ${modelEl.value ? modelEl.value + ' (custom)' : 'driver'}`.trim();
  document.getElementById('clone-save-name').value = defaultName;
  document.getElementById('clone-save-row').style.display = 'flex';
}

function cloneSaveConfirm() {
  const name = document.getElementById('clone-save-name').value.trim();
  document.getElementById('clone-save-row').style.display = 'none';
  if (!name) return;
  const [brand, ...rest] = name.split(' ');
  addMyDriver(brand || 'Custom', rest.join(' ') || name);
}

function cloneSaveCancel() {
  document.getElementById('clone-save-row').style.display = 'none';
}

function selectDriverFromEditor() {
  selectDriverSource = 'editor';
  resetSelectDriverModalChrome();
  // Hide, don't close: closeModal would be fine visually, but this keeps
  // the distinction clear that the editor session is still live underneath,
  // ready to resume once Select Driver is confirmed or cancelled.
  document.getElementById('modal-driver-editor').classList.remove('open');
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

function driverEditorFieldLines() {
  const brand = document.getElementById('de-brand-field').value || 'Custom';
  const model = document.getElementById('de-model-field').value || 'driver';
  const lines = [`Brand: ${brand}`, `Model: ${model}`];
  document.querySelectorAll('#modal-driver-editor .modal-pane[data-pane="parameters"] .pg-label').forEach(label => {
    const input = label.nextElementSibling;
    if (input) lines.push(`${label.textContent}: ${input.value}`);
  });
  return { brand, model, lines };
}

// The lossy, WinISD-compatible direction.
function exportDriverWdr() {
  const { brand, model, lines } = driverEditorFieldLines();
  downloadText(`${brand}_${model}.wdr.txt`.replace(/\s+/g, '_'), lines.join('\n'));
}

// OpenISD's own lossless format — everything captured above, just written
// with a kind: driver document shape instead of WDR's fixed field set.
function saveDriverNativeAs() {
  const { brand, model, lines } = driverEditorFieldLines();
  const yaml = ['kind: driver', ...lines.map(l => '  ' + l.replace(': ', ': '))].join('\n') + '\n';
  const chosen = window.prompt('Save driver as:', `${brand}_${model}.openisd-driver.yml`.replace(/\s+/g, '_'));
  if (!chosen) return;
  const filename = chosen.endsWith('.openisd-driver.yml') ? chosen : chosen + '.openisd-driver.yml';
  downloadText(filename, yaml, 'text/yaml');
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

  // Drag-to-scrub: press the field and drag to spin it. The dominant axis of the
  // drag sets direction (right / up = increment, left / down = decrement) and the
  // distance from the press point sets the SPEED — further = faster continuous
  // spin — like a jog dial. A press with no movement past the deadzone stays a
  // normal click so the field is still focusable for typing.
  const DRAG_DEADZONE = 6; // px before a press becomes a scrub (vs a click)
  input.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const ox = e.clientX, oy = e.clientY;
    let scrubbing = false;
    let disp = 0;          // signed displacement along the dominant axis
    let timer = null;

    const tick = () => {
      const level = Math.abs(disp) - DRAG_DEADZONE;
      if (level > 0) {
        step(disp > 0 ? 1 : -1);
        const interval = Math.max(24, 340 - level * 4.2); // further → shorter → faster
        timer = setTimeout(tick, interval);
      } else {
        timer = setTimeout(tick, 40); // inside deadzone: idle, keep polling
      }
    };
    const onMove = (ev) => {
      const dx = ev.clientX - ox, dy = ev.clientY - oy;
      disp = Math.abs(dx) >= Math.abs(dy) ? dx : -dy; // dominant axis; up = +, down = −
      if (!scrubbing && Math.abs(disp) > DRAG_DEADZONE) {
        scrubbing = true;
        document.body.style.userSelect = 'none';
        input.style.cursor = 'ew-resize';
        if (timer === null) tick();
      }
      if (scrubbing) ev.preventDefault();
    };
    const onUp = () => {
      if (timer !== null) clearTimeout(timer);
      document.body.style.userSelect = '';
      input.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
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
  addFilterRow('Lowpass');   // seed a default filter without opening the editor or marking dirty
  initSpinners(document);
  refreshProjectTraceVisibility();
  lastSavedSnapshot = captureProjectSnapshot();

  // Tune is reactive/live by design (the graph updates as you type), so any
  // edit there immediately modifies the project's in-memory state — same as
  // Edit's Done or a direct Select Driver, none of which are "saved" yet.
  document.getElementById('tune-panel').addEventListener('input', (e) => {
    if (e.target.matches('input')) markProjectModified();
  });

  document.querySelectorAll('.graph-wrap').forEach(wrap => {
    wrap.addEventListener('click', (e) => {
      const rect = wrap.getBoundingClientRect();
      const fx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const fy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const freq = Math.round((10 * Math.pow(2000, fx)) * 100) / 100;
      const db = Math.round((102 - fy * 60) * 1000) / 1000;
      const readout = document.getElementById('cursor-readout');
      if (readout) readout.innerHTML = freq.toFixed(2) + ' Hz<br>' + db.toFixed(3) + ' dB';
    });
  });
});
