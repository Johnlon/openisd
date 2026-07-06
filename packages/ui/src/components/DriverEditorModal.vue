<script setup lang="ts">
import { ref } from 'vue';
import { driver, driverRaw, enterDriverField, setDriverFromRaw, getDriverModel } from '../store.js';
import { ebp, RHO, C } from '@openisd/engine';
import type { DriverRaw } from '@openisd/engine';
import NumInput from './NumInput.vue';

// Driver editor — a real modal (unlike DriverWhatIfPanel, an inline overlay that keeps
// the graph visible). Recreates WinISD's "Driver editor" dialog (docs/winisd/edit_driver_pg*.png):
// 4 tabs — General / Parameters / Advanced parameters / Dimensions.
//
// Field honesty: only fields the engine actually reads/derives are wired live to the
// store (enterDriverField). Everything WinISD has that our engine does not compute or
// use is rendered visible-but-disabled with a short note — never a fabricated value
// standing in for real function.
//
// Provenance colouring (Entered/Calculated/Not available) is REAL, not decorative: it
// reads the Driver ADT's own cell(field) state (packages/winisd/src/driver.ts), the same
// source of truth the rest of the app uses to distinguish human-entered from derived.

const emit = defineEmits<{ close: [] }>();

type Tab = 'General' | 'Parameters' | 'Advanced parameters' | 'Dimensions';
const TABS: Tab[] = ['General', 'Parameters', 'Advanced parameters', 'Dimensions'];
const tab = ref<Tab>('General');

// Snapshot taken at mount (this component only exists while the editor is open — see
// ClassicShell's v-if) — Cancel reverts to exactly this, matching DriverWhatIfPanel's
// sessionSnapshot convention.
const sessionSnapshot: DriverRaw = { ...driverRaw.value };

function setText(field: 'brand' | 'model' | 'providedBy' | 'comment', e: Event) {
  enterDriverField(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}
function setNum(field: string, v: number) { enterDriverField(field, v); }

function cellClass(field: string): string {
  const st = getDriverModel().cell(field).state;
  return st === 'E' ? 'st-e' : st === 'C' ? 'st-c' : 'st-n';
}

// Plain function (not a Vue computed) — recomputed on every re-render along with
// cellClass above, driven by the same driverRaw/driver reactivity the rest of the
// template already reads, so EBP updates live as Fs/Qes change.
function ebpVal(): number | null {
  const d = driver.value;
  return d ? ebp(d) : null;
}

function close() { emit('close'); }
function cancel() { setDriverFromRaw(sessionSnapshot); emit('close'); }
function onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) cancel(); }
</script>

<template>
  <div class="overlay on" @click="onBackdrop">
    <div class="modal de-modal">
      <h2>Driver editor<button class="x" @click="cancel" title="Close without keeping changes">✕</button></h2>

      <div class="de-tabs">
        <button v-for="t in TABS" :key="t" class="de-tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>

      <div class="body de-body">
        <!-- ============================= General ============================= -->
        <div v-if="tab === 'General'" class="de-general">
          <div class="de-fld cl-dim" title="WinISD has a separate Manufacturer field distinct from Brand — OpenISD only tracks Brand. Not modelled.">
            <label>Manufacturer</label>
            <input type="text" disabled placeholder="not modelled — see Brand">
          </div>
          <div class="de-row2">
            <div class="de-fld" title="Manufacturer/brand name — WinISD: Brand">
              <label>Brand</label>
              <input type="text" :value="driverRaw.brand || ''" @input="setText('brand', $event)">
            </div>
            <div class="de-fld" title="Model number/name — WinISD: Model">
              <label>Model</label>
              <input type="text" :value="driverRaw.model || ''" @input="setText('model', $event)">
            </div>
          </div>
          <div class="de-row2">
            <div class="de-fld" title="Attribution — who supplied this driver's data. WinISD: Data provided by">
              <label>Data provided by</label>
              <input type="text" :value="driverRaw.providedBy || ''" @input="setText('providedBy', $event)">
            </div>
            <div class="de-fld cl-dim" title="OpenISD does not track a per-driver added date. Not modelled.">
              <label>Date added</label>
              <input type="text" disabled placeholder="not modelled">
            </div>
          </div>
          <div class="de-fld de-comment" title="Free-text note saved with this driver. WinISD: Comment">
            <label>Comment</label>
            <textarea :value="driverRaw.comment || ''" @input="setText('comment', $event)"></textarea>
          </div>

          <div class="de-legend">
            <span class="de-sw st-e"></span>Entered
            <span class="de-sw st-c"></span>Calculated
            <span class="de-sw st-n"></span>Not available
          </div>
          <label class="de-auto" title="OpenISD always auto-derives every field it can from what you've entered — there is no way to turn this off, so the checkbox is fixed on.">
            <input type="checkbox" checked disabled> Auto calculate unknowns
          </label>
        </div>

        <!-- ============================= Parameters ============================= -->
        <div v-if="tab === 'Parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thiele/Small parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld" title="Electrical Q factor — motor damping. WinISD: Qes">
                  <label>Qes</label>
                  <NumInput :class="cellClass('Qes')" :model-value="driverRaw.Qes ?? 0" :scale="1" :precision="3" @update:model-value="v => setNum('Qes', v)">
                  </NumInput>
                </div>
                <div class="de-fld" title="Equivalent compliance volume. WinISD: Vas">
                  <label>Vas</label>
                  <NumInput :class="cellClass('Vas')" :model-value="driverRaw.Vas ?? 0" :scale="1000" :precision="3" @update:model-value="v => setNum('Vas', v)">
                  </NumInput>
                  <span class="u">L</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld" title="Mechanical Q factor — suspension damping. WinISD: Qms">
                  <label>Qms</label>
                  <NumInput :class="cellClass('Qms')" :model-value="driverRaw.Qms ?? 0" :scale="1" :precision="3" @update:model-value="v => setNum('Qms', v)">
                  </NumInput>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld" title="Total Q factor = Qes·Qms/(Qes+Qms). WinISD: Qts">
                  <label>Qts</label>
                  <NumInput :class="cellClass('Qts')" :model-value="driverRaw.Qts ?? 0" :scale="1" :precision="3" @update:model-value="v => setNum('Qts', v)">
                  </NumInput>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld" title="Free-air resonance frequency. WinISD: Fs">
                  <label>Fs</label>
                  <NumInput :class="cellClass('Fs')" :model-value="driverRaw.Fs ?? 0" :scale="1" :precision="2" @update:model-value="v => setNum('Fs', v)">
                  </NumInput>
                  <span class="u">Hz</span>
                </div>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Electro-Mechanical parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld st-c" title="Derived: Mms = 1 / ((2π·Fs)²·Cms) — total moving mass. Read-only, not entered directly.">
                  <label>Mms</label>
                  <input type="text" readonly :value="driver?.Mms != null ? (driver.Mms * 1000).toFixed(2) : ''"><span class="u">g</span>
                </div>
                <div class="de-fld st-c" title="Derived: Bl = √(2π·Fs·Mms·Re / Qes) — motor force factor. Read-only, not entered directly.">
                  <label>BL</label>
                  <input type="text" readonly :value="driver?.Bl != null ? driver.Bl.toFixed(3) : ''"><span class="u">Tm</span>
                </div>
                <div class="de-fld cl-dim" title="Voice-coil inductance corner frequency — not modelled in OpenISD.">
                  <label>fLe</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">kHz</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld st-c" title="Derived: Cms = Vas / (ρc²·Sd²) — suspension compliance. Read-only, not entered directly.">
                  <label>Cms</label>
                  <input type="text" readonly :value="driver?.Cms != null ? (driver.Cms * 1000).toFixed(4) : ''"><span class="u">mm/N</span>
                </div>
                <div class="de-fld cl-dim" title="Diaphragm/dome depth — not modelled in OpenISD.">
                  <label>Dd</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">m</span>
                </div>
                <div class="de-fld cl-dim" title="Le semi-inductance coefficient — not modelled in OpenISD.">
                  <label>KLe</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">H·√Hz</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld st-c" title="Derived: Rms = 2π·Fs·Mms/Qms — suspension mechanical resistance. Read-only, not entered directly.">
                  <label>Rms</label>
                  <input type="text" readonly :value="driver?.Rms != null ? driver.Rms.toFixed(4) : ''"><span class="u">Ns/m</span>
                </div>
                <div class="de-fld" title="Voice coil inductance. 0 = resistive-only model. WinISD: Le">
                  <label>Le</label>
                  <NumInput :class="cellClass('Le')" :model-value="driverRaw.Le ?? 0" :scale="1000" :precision="3" @update:model-value="v => setNum('Le', v)">
                  </NumInput>
                  <span class="u">mH</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld" title="DC voice coil resistance. WinISD: Re">
                  <label>Re</label>
                  <NumInput :class="cellClass('Re')" :model-value="driverRaw.Re ?? 0" :scale="1" :precision="3" @update:model-value="v => setNum('Re', v)">
                  </NumInput>
                  <span class="u">ohm</span>
                </div>
                <div class="de-fld" title="Effective piston area. WinISD: Sd">
                  <label>Sd</label>
                  <NumInput :class="cellClass('Sd')" :model-value="driverRaw.Sd ?? 0" :scale="1e4" :precision="4" @update:model-value="v => setNum('Sd', v)">
                  </NumInput>
                  <span class="u">cm²</span>
                </div>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Large-Signal parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld" title="Peak one-way linear excursion. WinISD: Xmax">
                  <label>Xmax</label>
                  <NumInput :class="cellClass('Xmax')" :model-value="driverRaw.Xmax ?? 0" :scale="1000" :precision="3" @update:model-value="v => setNum('Xmax', v)">
                  </NumInput>
                  <span class="u">mm peak</span>
                </div>
                <div class="de-fld cl-dim" title="Mechanical excursion limit before physical damage — not modelled in OpenISD (only Xmax is used).">
                  <label>Xlim</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">mm</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Voice coil former height above/below the gap — not modelled in OpenISD.">
                  <label>Hc</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">mm</span>
                </div>
                <div class="de-fld" title="Rated continuous power handling. WinISD: Pe">
                  <label>Pe</label>
                  <NumInput :class="cellClass('Pe')" :model-value="driverRaw.Pe ?? 0" :scale="1" :precision="1" @update:model-value="v => setNum('Pe', v)">
                  </NumInput>
                  <span class="u">W</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Magnetic gap height — not modelled in OpenISD.">
                  <label>Hg</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">mm</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Volume displaced by the cone at Xmax — not modelled in OpenISD.">
                  <label>Vd</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">cm³</span>
                </div>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Miscellaneous parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld cl-dim" title="Reference efficiency — not modelled in OpenISD.">
                  <label>no</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">%</span>
                </div>
                <div class="de-fld cl-dim" title="Number of voice coils — not modelled in OpenISD (see Placement's Num. of drivers on the Driver tab for multi-driver systems).">
                  <label>Voicecoils</label>
                  <input type="text" disabled placeholder="not modelled">
                </div>
                <div class="de-fld cl-dim" title="Dual voice coil wiring (this driver's own coils) — not modelled in OpenISD (see Placement's Voice coil connection for multi-driver wiring).">
                  <label>Connection</label>
                  <select disabled><option>Parallel</option></select>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld" title="Nominal impedance — label only, not used in simulation. WinISD: Znom. OpenISD field: Z">
                  <label>Znom</label>
                  <NumInput :class="cellClass('Z')" :model-value="driverRaw.Z ?? 0" :scale="1" :precision="3" @update:model-value="v => setNum('Z', v)">
                  </NumInput>
                  <span class="u">ohm</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Unity SPL — not modelled in OpenISD.">
                  <label>USPL</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">dB</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Rated sensitivity — not modelled in OpenISD.">
                  <label>SPL</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">dB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Advanced parameters ============================= -->
        <div v-if="tab === 'Advanced parameters'" class="de-params">
          <div class="de-group">
            <div class="de-hdr">Thermal parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld cl-dim" title="Voice coil resistance temperature coefficient — not modelled in OpenISD (no thermal power compression model).">
                  <label>AlfaVC</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">1000/K</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Thermal resistance voice coil→ambient — not modelled in OpenISD.">
                  <label>R(t)</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">K/W</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Thermal capacitance — not modelled in OpenISD.">
                  <label>C(t)</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">J/K</span>
                </div>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Figure of merits</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld cl-dim" title="Max SPL, low-frequency-limited — not modelled in OpenISD.">
                  <label>SPLmaxLF</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">dB</span>
                </div>
                <div class="de-fld cl-dim" title="Power-limited motor figure of merit — not modelled in OpenISD.">
                  <label>Mpow</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">N/√W</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Max SPL — not modelled in OpenISD.">
                  <label>SPLmax</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">dB</span>
                </div>
                <div class="de-fld cl-dim" title="Cost-normalised motor figure of merit — not modelled in OpenISD.">
                  <label>Mcost</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">kg/s</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Motional electrical resistance at resonance — not modelled in OpenISD.">
                  <label>Rme</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">Ns/m</span>
                </div>
                <div class="de-fld st-c" title="Derived: EBP = Fs / Qes — Efficiency Bandwidth Product. Read-only, not entered directly. WinISD: EBP">
                  <label>EBP</label>
                  <input type="text" readonly :value="ebpVal() != null ? ebpVal()!.toFixed(1) : ''"><span class="u">Hz</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Motor figure of merit — not modelled in OpenISD.">
                  <label>gamma</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">N/(A·kg)</span>
                </div>
                <div class="de-fld cl-dim" title="Cone material loss factor — not modelled in OpenISD.">
                  <label>Gloss</label>
                  <input type="text" disabled placeholder="not modelled"><span class="u">%</span>
                </div>
              </div>
            </div>
          </div>

          <div class="de-group">
            <div class="de-hdr">Environment parameters</div>
            <div class="de-cols">
              <div class="de-col">
                <div class="de-fld cl-dim" title="Speed of sound — OpenISD's engine constant, fixed at 20°C (packages/engine/src/constants.ts). Not adjustable in this editor.">
                  <label>c</label>
                  <input type="text" readonly :value="C.toFixed(2)"><span class="u">m/s</span>
                </div>
              </div>
              <div class="de-col">
                <div class="de-fld cl-dim" title="Air density — OpenISD's engine constant, fixed at 20°C (packages/engine/src/constants.ts). Not adjustable in this editor.">
                  <label>roo</label>
                  <input type="text" readonly :value="RHO.toFixed(5)"><span class="u">kg/m³</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================= Dimensions ============================= -->
        <div v-if="tab === 'Dimensions'" class="de-dims">
          <div class="de-dimlist">
            <div class="de-hdr">Dimensions</div>
            <div class="de-fld cl-dim" title="Frame flange thickness — not modelled in OpenISD."><label>Thick</label><input type="text" disabled placeholder="0.00"><span class="u">in</span></div>
            <div class="de-fld cl-dim" title="Overall driver depth — not modelled in OpenISD."><label>Depth</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Magnet stack depth — not modelled in OpenISD."><label>Magnet Depth</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Magnet diameter — not modelled in OpenISD."><label>Magnet</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Basket/frame diameter — not modelled in OpenISD."><label>Basket</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Overall outer frame diameter — not modelled in OpenISD."><label>Outer</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Voice coil diameter — not modelled in OpenISD."><label>VCd</label><input type="text" disabled placeholder="0.000"><span class="u">m</span></div>
            <div class="de-fld cl-dim" title="Basket displacement volume — not modelled in OpenISD."><label>Dvol</label><input type="text" disabled placeholder="0.0"><span class="u">in³</span></div>
            <div class="de-note">Physical dimensions are not modelled in OpenISD — the diagram is shown for reference only.</div>
          </div>
          <div class="de-diagram" aria-hidden="true" title="Driver cross-section (reference diagram — dimensions not modelled)">
            <svg width="300" height="260" viewBox="0 0 300 260">
              <!-- frame + cone -->
              <path d="M60 70 L150 45 v170 L60 190 Z" fill="#eee" stroke="#333" stroke-width="1.5"/>
              <!-- magnet stack -->
              <rect x="150" y="90" width="55" height="80" fill="#ddd" stroke="#333" stroke-width="1.5"/>
              <!-- outer plate / frame back -->
              <rect x="205" y="60" width="10" height="140" fill="#111" stroke="#111"/>
              <!-- voice coil former -->
              <rect x="140" y="112" width="14" height="36" fill="#ccc" stroke="#333"/>

              <!-- Thick (top, near frame back) -->
              <line x1="205" y1="30" x2="215" y2="30" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="210" y="20" text-anchor="middle" font-size="12">Thick</text>

              <!-- Outer (right, full frame-back height) -->
              <line x1="235" y1="60" x2="235" y2="200" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="252" y="130" text-anchor="middle" font-size="12" transform="rotate(90 252 130)">Outer</text>

              <!-- Basket (left, full basket height) -->
              <line x1="35" y1="70" x2="35" y2="190" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="20" y="130" text-anchor="middle" font-size="12" transform="rotate(-90 20 130)">Basket</text>

              <!-- Magnet (vertical, magnet stack height) -->
              <line x1="130" y1="90" x2="130" y2="170" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="115" y="130" text-anchor="middle" font-size="12" transform="rotate(-90 115 130)">Magnet</text>

              <!-- MagDpt (bottom, magnet stack depth) -->
              <line x1="150" y1="215" x2="205" y2="215" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="177" y="230" text-anchor="middle" font-size="12">MagDpt</text>

              <!-- Depth (bottom, overall) -->
              <line x1="60" y1="240" x2="215" y2="240" stroke="#111" marker-start="url(#deArrow)" marker-end="url(#deArrow)"/>
              <text x="137" y="255" text-anchor="middle" font-size="12">Depth</text>

              <defs>
                <marker id="deArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#111"/>
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      <div class="de-footer">
        <div class="de-legend2">
          <span class="de-sw st-e"></span>Entered
          <span class="de-sw st-c"></span>Calculated
          <span class="de-sw st-n"></span>Not available
        </div>
        <div class="de-btns">
          <button title="Save/load to a .wdr file is not implemented in this editor yet — your edits already apply live to the current project" @click="close">Save</button>
          <button disabled title="Load from a .wdr file is not implemented in this editor yet — use the toolbar's folder icon to load a driver from the library">Load</button>
          <button disabled title="Clear is not implemented in this editor yet">Clear</button>
          <button class="pri" @click="cancel" title="Discard edits made in this session and close">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.de-modal { width: min(920px, 95vw); }
.de-tabs { display: flex; gap: 2px; padding: 8px 14px 0; border-bottom: 1px solid var(--line); }
.de-tab { padding: 6px 14px; border: 1px solid var(--line); border-bottom: none; border-radius: 4px 4px 0 0; background: var(--panel2); color: var(--fg); cursor: pointer; font: inherit; }
.de-tab.on { background: var(--panel); font-weight: 600; }
.de-body { display: flex; flex-direction: column; gap: 10px; }

.de-fld { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.de-fld label { font-size: 12px; color: var(--mut); }
.de-fld input, .de-fld select { padding: 4px 7px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); width: 130px; }
.de-fld .u { font-size: 11px; color: var(--mut); }
.de-fld.cl-dim input, .de-fld.cl-dim select { background: var(--panel2); color: var(--mut); }
.de-row2 { display: flex; gap: 16px; }
.de-row2 .de-fld { flex: 1; }
.de-row2 .de-fld input { width: 100%; }
.de-comment textarea { width: 100%; min-height: 90px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 3px; font: inherit; background: var(--panel); color: var(--fg); resize: vertical; }

.de-legend, .de-legend2 { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mut); margin-top: 6px; }
.de-sw { width: 14px; height: 14px; border: 1px solid var(--line); border-radius: 2px; display: inline-block; margin-left: 8px; }
.de-legend .de-sw:first-child, .de-legend2 .de-sw:first-child { margin-left: 0; }
.de-sw.st-e { background: var(--good); }
.de-sw.st-c { background: var(--acc); }
.de-sw.st-n { background: #333; }
.de-auto { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; opacity: .8; }

/* Provenance colouring — text colour on the value, matching the legend swatches.
   Two shapes: cellClass() lands directly on NumInput's root <input> (fallthrough
   attrs), or on a wrapping .de-fld for the read-only derived fields. */
input.st-e, .de-fld.st-e input { color: var(--good); }
input.st-c, .de-fld.st-c input { color: var(--acc); }
input.st-n, .de-fld.st-n input { color: var(--fg); }

.de-group { margin-bottom: 6px; }
.de-hdr { background: var(--panel2); text-align: center; font-size: 12px; padding: 4px 0; border-radius: 3px; margin-bottom: 8px; color: var(--mut); }
.de-cols { display: flex; gap: 22px; flex-wrap: wrap; }
.de-col { display: flex; flex-direction: column; }

.de-dims { display: flex; gap: 24px; align-items: flex-start; }
.de-dimlist { width: 200px; flex-shrink: 0; }
.de-note { font-size: 11px; color: var(--mut); font-style: italic; margin-top: 4px; }
.de-diagram { flex: 1; display: flex; justify-content: center; padding-top: 8px; }
.de-diagram svg { color: var(--fg); }
.de-diagram text { fill: var(--fg); }

.de-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--line); }
.de-btns { display: flex; gap: 6px; }
.de-btns .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
</style>
