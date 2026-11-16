// The passive-radiator editor (John, 16 Nov 2026, QO946.c115): OK applies, Cancel discards, Save to My PRs files a copy.
import {describe, expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@openisd/persistence';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {type ApplyRadiator, createPassiveRadiatorEditor} from '../../src/hooks/passiveRadiatorEditor.js';
import {myPassiveRadiatorRepoOn} from '../fixtures/repoOn.js';

function setUp() {
  const myPassiveRadiators = myPassiveRadiatorRepoOn(createMemoryStorage());
  const resolve = vi.fn();
  const editor = createPassiveRadiatorEditor({myPassiveRadiators, resolve});
  const source = OpenISDPassiveRadiatorStandalone.empty();
  source.model.set('Source PR');
  source.spec.Xmax_m.set(0.01);
  return {myPassiveRadiators, resolve, editor, source};
}

describe('createPassiveRadiatorEditor', () => {
  it('opens on a copy: typing changes the copy, never the radiator it came from', () => {
    const {editor, source, resolve} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    expect(editor.name.value).toBe('Source PR');
    expect(editor.cells.value?.Xmax_m.value).toBe(0.01);

    editor.cells.value?.Xmax_m.set(0.02);
    editor.setName('Changed');

    expect(resolve).toHaveBeenCalled();
    expect(editor.cells.value?.Xmax_m.value).toBe(0.02);
    expect(source.spec.Xmax_m.value).toBe(0.01);
    expect(source.model.value).toBe('Source PR');
    expect(apply).not.toHaveBeenCalled();
  });

  it('OK hands the edited radiator to apply and closes', () => {
    const {editor, source} = setUp();
    const apply = vi.fn<ApplyRadiator>();
    editor.open(source, 'Edit passive radiator', apply);
    editor.cells.value?.Xmax_m.set(0.02);
    editor.setName('Changed');

    editor.ok();

    expect(apply).toHaveBeenCalledTimes(1);
    const applied = apply.mock.calls[0]?.[0];
    expect(applied?.model.value).toBe('Changed');
    expect(applied?.spec.Xmax_m.value).toBe(0.02);
    expect(editor.cells.value).toBeNull();
  });

  it('Cancel keeps nothing', () => {
    const {editor, source, myPassiveRadiators} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    editor.setName('Thrown away');

    editor.cancel();

    expect(apply).not.toHaveBeenCalled();
    expect(editor.cells.value).toBeNull();
    expect(myPassiveRadiators.list()).toHaveLength(0);
  });

  it('Save to My PRs files a copy under its name, says so, and a second save updates that entry', () => {
    const {editor, source, myPassiveRadiators} = setUp();
    const apply = vi.fn();
    editor.open(source, 'Edit passive radiator', apply);
    editor.setName('Filed');

    editor.saveToMyPRs();
    editor.cells.value?.Xmax_m.set(0.03);
    editor.saveToMyPRs();

    const list = myPassiveRadiators.list();
    expect(list.map(e => e.passiveRadiator.model.value)).toEqual(['Filed']);
    expect(list[0]?.passiveRadiator.spec.Xmax_m.value).toBe(0.03);
    expect(editor.savedNote.value).toContain('Filed');
    expect(editor.savedRevision.value).toBe(2);
    expect(apply).not.toHaveBeenCalled();
    expect(editor.cells.value).not.toBeNull();
  });

  it('Save to My PRs needs a name', () => {
    const {editor, myPassiveRadiators} = setUp();
    editor.open(OpenISDPassiveRadiatorStandalone.empty(), 'Define new passive radiator', vi.fn());
    expect(editor.canSave.value).toBe(false);

    editor.saveToMyPRs();

    expect(myPassiveRadiators.list()).toHaveLength(0);
    expect(editor.savedNote.value).toMatch(/^Not copied: give it a name first/);
  });
});

describe('createPassiveRadiatorEditor — the driver editor\'s tools (John, 16 Nov 2026 11:42, 12:46)', () => {
  it('Reset puts back what the editor opened with', () => {
    const {editor, source} = setUp();
    editor.open(source, 'Edit', vi.fn());
    editor.cells.value?.Xmax_m.set(0.05);
    editor.setName('Changed');

    editor.reset();

    expect(editor.cells.value?.Xmax_m.value).toBe(0.01);
    expect(editor.name.value).toBe('Source PR');
  });

  it('Auto calculate unknowns off: a typed figure recalculates nothing; turning it on recalculates', () => {
    const {editor, source, resolve} = setUp();
    editor.open(source, 'Edit', vi.fn());
    resolve.mockClear();
    editor.setAutoCalculate(false);
    editor.cells.value?.Xmax_m.set(0.02);
    expect(resolve).not.toHaveBeenCalled();
    expect(editor.autoCalculate.value).toBe(false);

    editor.setAutoCalculate(true);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(editor.autoCalculate.value).toBe(true);
  });

  it('Inspect Provenance names a figure\'s state and the formulas that give it from the radiator\'s own figures', () => {
    const {editor, source} = setUp();
    editor.open(source, 'Edit', vi.fn());
    expect(editor.provenance.value).toBeNull();
    editor.setInspect(true);
    editor.inspectField('Cms_m_per_N');

    const p = editor.provenance.value;
    expect(p?.label).toBe('Cms');
    expect(p?.state).toBe('Not available');
    expect(p?.formulas.length).toBeGreaterThan(0);
    expect(p?.formulas.join(' ')).toContain('Vas');
    expect(p?.formulas.join(' ')).not.toContain('Qes');   // a driver-only route is not the radiator's

    editor.inspectField('Xmax_m');
    expect(editor.provenance.value?.state).toBe('Entered');
    editor.setInspect(false);
    expect(editor.provenance.value).toBeNull();
  });

  it('Export writes the radiator under its name and says so; Import reads a file back into the editor and says so', async () => {
    const myPassiveRadiators = myPassiveRadiatorRepoOn(createMemoryStorage());
    const saved: {name: string; text: string}[] = [];
    const flash = vi.fn();
    const editor = createPassiveRadiatorEditor({
      myPassiveRadiators, resolve: vi.fn(),
      files: {
        save: async (pr, fileName) => { saved.push({name: fileName, text: pr.toOwdrText()}); return fileName; },
        read: text => OpenISDPassiveRadiatorStandalone.fromOwdrText(text),
        flash,
      },
    });
    const source = OpenISDPassiveRadiatorStandalone.empty();
    source.brand.set('Accuton');
    source.model.set('ASP190');
    source.spec.Xmax_m.set(0.012);
    editor.open(source, 'Edit', vi.fn());

    await editor.exportFile();

    expect(saved.map(f => f.name)).toEqual(['Accuton ASP190.owdr']);
    expect(flash).toHaveBeenLastCalledWith('Passive radiator exported as Accuton ASP190.owdr');

    editor.cells.value?.Xmax_m.set(0.03);
    editor.importText('Accuton ASP190.owdr', saved[0]?.text ?? '');
    expect(editor.cells.value?.Xmax_m.value).toBe(0.012);
    expect(flash).toHaveBeenLastCalledWith('Passive radiator imported from Accuton ASP190.owdr');

    editor.importText('junk.owdr', 'not json');
    expect(flash.mock.calls.at(-1)?.[0]).toMatch(/^Could not import junk\.owdr: /);
    expect(editor.cells.value?.Xmax_m.value).toBe(0.012);
  });
});

// John, 16 Nov 2026 14:03: the General tab stays only because the radiator record carries the driver's General fields;
// it shows them as the driver editor does (Manufacturer, Brand, Model, Data provided by, Date added, Comment).
describe('createPassiveRadiatorEditor — the General fields the radiator record carries', () => {
  it('shows and edits the copy\'s identity, never the source\'s; OK hands the edits on', () => {
    const {editor, source} = setUp();
    source.brand.set('Accuton');
    source.manufacturer.set('Accuton GmbH');
    const apply = vi.fn<ApplyRadiator>();
    editor.open(source, 'Edit', apply);
    expect(editor.identity.value.brand).toBe('Accuton');
    expect(editor.identity.value.model).toBe('Source PR');
    expect(editor.identity.value.manufacturer).toBe('Accuton GmbH');

    editor.setIdentity('brand', 'Bench');
    editor.setIdentity('comment', 'Measured at home');
    expect(source.brand.value).toBe('Accuton');
    editor.ok();

    expect(apply.mock.calls[0]?.[0]?.brand.value).toBe('Bench');
    expect(apply.mock.calls[0]?.[0]?.comment.value).toBe('Measured at home');
  });
});
