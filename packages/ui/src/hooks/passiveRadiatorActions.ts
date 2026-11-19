/**
 * Passive-radiator actions on the PR page (Enclosure tab, PR box type) — loading a saved PR or a
 * bundled catalogue entry, the radiator's Info, and the passive-radiator editor (Edit, and the Select popup's Define new;
 * its Copy to My PRs is what Save to library was).
 * Skin-neutral: shared by every shell's PR page (one implementation, two presentations).
 */
import {ref} from 'vue';
import {isoDay, NumberField} from '@openisd/design/fields';
import type {ComputedRef} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo} from '@openisd/persistence';
import type {RadiatorPicks} from '../logic/telemetry/radiatorPick.js';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createPassiveRadiatorEditor, type PassiveRadiatorFiles, type RadiatorEngineAreas, resolveInAppAir} from './passiveRadiatorEditor.js';

/** One figure in the radiator's Info view. */
export interface PassiveRadiatorInfoFigure { readonly label: string; readonly value: string; readonly unit: string; }
/** One identity line in the radiator's Info view. */
export interface PassiveRadiatorInfoLine { readonly label: string; readonly value: string; }
/** The radiator's Info view, as the driver's Info shows a driver. */
/** A link the Info view shows: the radiator's datasheet or maker's page, when its record carries one. */
export interface PassiveRadiatorInfoLink { readonly label: string; readonly url: string; }
export interface PassiveRadiatorInfo {
  readonly title: string;
  /** "Passive Radiator": the Info says what it is, as the driver's says its type (QO946.c119). */
  readonly type: string;
  readonly links: readonly PassiveRadiatorInfoLink[];
  readonly figures: readonly PassiveRadiatorInfoFigure[];
  readonly lines: readonly PassiveRadiatorInfoLine[];
}

export interface PassiveRadiatorActionsDeps {
  project: ComputedRef<OpenISDProject>;
  myPassiveRadiators: MyPassiveRadiatorRepo;
  bundledPassiveRadiators: BundledPassiveRadiatorRepo;
  /** Told which radiator the user loaded, for usage statistics. */
  radiatorPicks: RadiatorPicks;
  /** Where the editor's calculated figures come from. */
  engine: RadiatorEngineAreas;
  /** The editor's Export and Import. */
  files?: PassiveRadiatorFiles;
}

export function createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators, radiatorPicks, engine, files }: PassiveRadiatorActionsDeps) {
  const prBrowseOpen = ref(false);
  function loadPREntry(uuid: string) {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (!entry) return;
    project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
    radiatorPicks.saved();
    prBrowseOpen.value = false;
  }
  async function loadBundledPassiveRadiatorEntry(uuid: string): Promise<void> {
    const pr = await bundledPassiveRadiators.load(uuid);
    project.value.box.passiveRadiator.configurePR(pr);
    radiatorPicks.bundled(uuid);
    prBrowseOpen.value = false;
  }
  // ---- The passive-radiator editor (John, 16 Nov 2026, QO946.c115) -----------------------------------------------
  // Edits a copy of the radiator; OK puts it in the project's box as edited (nothing stated is dropped), Cancel keeps
  // nothing. The project's count, added mass and tuning are not the radiator's and are not touched (QO946.c38).
  const prEditor = createPassiveRadiatorEditor({ myPassiveRadiators, resolve: resolveInAppAir(engine), radiatorFormulas: engine.pr.routeFormulas(), files });
  const useRadiator = (pr: OpenISDPassiveRadiatorStandalone): void => { project.value.box.passiveRadiator.holdEditedPR(pr); };
  function startEditPR(): void {
    prEditor.open(project.value.box.passiveRadiator.radiator.detach(), "Edit Project's Passive Radiator", useRadiator);
  }
  /** The Select popup's "+ Define new passive radiator": the editor on a blank radiator; OK makes it the project's and
   *  closes the popup. */
  function defineNewPREntry(): void {
    prEditor.open(OpenISDPassiveRadiatorStandalone.empty(), 'Define new passive radiator', pr => {
      useRadiator(pr);
      prBrowseOpen.value = false;
    });
  }
  // ---- Info: the radiator's figures and identity, read only, as the driver's Info ------------------------------
  const prInfoOpen = ref(false);
  /** Read when Info opens: the radiator as it stands then (the project's fields are not reactive). */
  function infoNow(): PassiveRadiatorInfo {
    const r = project.value.box.passiveRadiator.radiator;
    const sp = r.spec;
    // Each figure formatted and labelled by its field, as the driver's Info (driverDisplay `fmtField`).
    const fig = (field: NumberField, v: number | null): PassiveRadiatorInfoFigure =>
      ({ label: field.label, value: v === null ? '—' : field.format(v), unit: field.unitLabel() });
    return {
      title: [r.brand.value, r.model.value].filter(t => t !== '').join(' ') || 'Unnamed passive radiator',
      type: 'Passive Radiator',
      links: [
        { label: 'Datasheet (PDF) ↗', url: r.dataSource('manufacturer_datasheet') ?? '' },
        { label: 'Manufacturer page ↗', url: r.dataSource('manufacturer_product_page') ?? '' },
      ].filter(l => l.url !== ''),
      figures: [
        fig(NumberField.PR_VAS_L, sp.Vas_m3.value), fig(NumberField.PR_QMS, sp.Qms.value),
        fig(NumberField.PR_FS_HZ, sp.Fs_hz.value), fig(NumberField.PR_SD_CM2, sp.Sd_m2.value),
        fig(NumberField.MMS_KG, sp.Mms_kg.value), fig(NumberField.CMS_M_PER_N, sp.Cms_m_per_N.value),
        fig(NumberField.RMS_KG_PER_S, sp.Rms_kg_per_s.value), fig(NumberField.PR_XMAX_MM, sp.Xmax_m.value),
      ],
      lines: [
        { label: 'Brand', value: r.brand.value }, { label: 'Model', value: r.model.value },
        { label: 'Manufacturer', value: r.manufacturer.value }, { label: 'Measured by', value: r.providedBy.value ?? '' },
        { label: 'Date added', value: isoDay(r.added.value ?? '') }, { label: 'Description', value: r.comment.value ?? '' },
      ].filter(l => l.value !== ''),
    };
  }
  /** Null until Info first opens: the page can be drawn with no project focused. */
  const prInfo = ref<PassiveRadiatorInfo | null>(null);
  function openPRInfo(): void { prInfo.value = infoNow(); prInfoOpen.value = true; }

  return {
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry,
    prEditor, startEditPR, defineNewPREntry, prInfoOpen, prInfo, openPRInfo,
  };
}
