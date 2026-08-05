import { describe, it, expect } from 'vitest';
import { OpenISDProject, type ProjectContent } from '../src/model/OpenISDProject.js';
import { toSnapshot, fromSnapshot } from '../src/model/workspace.js';
import type { UiParams, ProjectMeta } from '../src/types.js';

/**
 * The project model's contract (STATE_MODEL.md):
 *   save    → the working state becomes the file's sole content AND the new ground
 *   load    → the file's state becomes the ground, so the project opens clean
 *   copy    → an independent, unsaved project with no link back to its source
 *   trial   → reads as the content while it runs; kept or thrown away, never saved
 * `isModified` is derived from the layers, never stored.
 */

const meta = (name: string): ProjectMeta =>
  ({ name, creator: 'spec', created: '2026-07-31', modified: '2026-07-31', description: '' });

function content(name = 'Project A', Vb = 0.030): ProjectContent {
  return {
    box: 'vented',
    P: { Vb } as unknown as UiParams,
    driver: { inputs: { name: 'Driver', Fs: 37 } },
    meta: meta(name),
  };
}

describe('OpenISDProject', () => {
  it('a new project is unsaved: there is no file behind it to be clean against', () => {
    const p = OpenISDProject.create(content());
    expect(p.isModified).toBe(true);
    expect(p.canRevert).toBe(false);
    expect(p.groundContent()).toBeNull();
  });

  it('saving makes the working state the file content AND the new ground', () => {
    const p = OpenISDProject.create(content('A', 0.030));
    p.update(content('A', 0.042));

    const file = p.toOwpr();
    expect(file.content.P.Vb).toBe(0.042);   // the file carries the working state, not the old one

    p.markSaved();
    expect(p.isModified).toBe(false);        // nothing unsaved the instant the save lands
    expect(p.groundContent()!.P.Vb).toBe(0.042);
  });

  it('loading a file makes that state the ground — the project opens clean', () => {
    const saved = OpenISDProject.create(content('A', 0.055));
    const reopened = OpenISDProject.fromOwpr(saved.toOwpr());

    expect(reopened.isModified).toBe(false);
    expect(reopened.content().P.Vb).toBe(0.055);
    expect(reopened.canRevert).toBe(true);
  });

  it('editing after a save reads as modified, and revert goes back to the file', () => {
    const p = OpenISDProject.fromOwpr(OpenISDProject.create(content('A', 0.030)).toOwpr());
    p.update(content('A', 0.099));
    expect(p.isModified).toBe(true);

    p.revert();
    expect(p.isModified).toBe(false);
    expect(p.content().P.Vb).toBe(0.030);
  });

  it('a copy is an independent unsaved project — editing it cannot touch its source', () => {
    const source = OpenISDProject.fromOwpr(OpenISDProject.create(content('A', 0.030)).toOwpr());
    const copy = source.copy('Copy of A');

    expect(copy.id).not.toBe(source.id);
    expect(copy.isModified).toBe(true);      // no file behind it
    expect(copy.canRevert).toBe(false);      // and nothing to revert to

    copy.update(content('Copy of A', 0.077));
    expect(source.content().P.Vb).toBe(0.030);
    expect(source.isModified).toBe(false);
  });

  it('a trial reads as the content, is not saved, and leaves nothing behind when discarded', () => {
    const p = OpenISDProject.fromOwpr(OpenISDProject.create(content('A', 0.030)).toOwpr());

    p.beginTransient();
    p.setTransient(content('A', 0.200));
    expect(p.content().P.Vb).toBe(0.200);      // on screen
    expect(p.toOwpr().content.P.Vb).toBe(0.030); // never in the file
    expect(p.isModified).toBe(false);            // a trial is not a change to the project

    p.discardTransient();
    expect(p.content().P.Vb).toBe(0.030);
    expect(p.isModified).toBe(false);
  });

  it('keeping a trial makes it the working state, and only then is the project modified', () => {
    const p = OpenISDProject.fromOwpr(OpenISDProject.create(content('A', 0.030)).toOwpr());
    p.beginTransient();
    p.setTransient(content('A', 0.150));
    p.keepTransient();

    expect(p.hasTransient).toBe(false);
    expect(p.content().P.Vb).toBe(0.150);
    expect(p.isModified).toBe(true);
  });

  it('no two projects share mutable state, however they were made', () => {
    const a = OpenISDProject.create(content('A'));
    const b = OpenISDProject.fromOwpr(a.toOwpr());
    const c = a.copy('C');

    const edited = content('A', 0.999);
    a.update(edited);
    edited.P.Vb = 0.5;                       // mutate the object we handed in

    expect(a.content().P.Vb).toBe(0.999);    // the project kept its own copy
    expect(b.content().P.Vb).toBe(0.030);
    expect(c.content().P.Vb).toBe(0.030);
  });
});

describe('workspace', () => {
  it('round-trips the open projects, the active one, and each row\'s own view state', () => {
    const saved = OpenISDProject.fromOwpr(OpenISDProject.create(content('Saved')).toOwpr());
    const fresh = OpenISDProject.create(content('Fresh'));
    const open = [
      { project: saved, visible: false, color: '#ff0000' },
      { project: fresh, visible: true },
    ];

    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(open, fresh.id))));

    expect(restored.activeId).toBe(fresh.id);
    expect(restored.open.map(o => o.project.id)).toEqual([saved.id, fresh.id]);
    expect(restored.open[0].visible).toBe(false);      // a hidden row stays hidden
    expect(restored.open[0].project.isModified).toBe(false);  // and a clean project stays clean
    expect(restored.open[1].project.isModified).toBe(true);   // an unsaved one stays unsaved
  });

  it('persists inputs only — no curves ride along', () => {
    const p = OpenISDProject.create(content('A'));
    const wire = JSON.stringify(toSnapshot([{ project: p, visible: true }], p.id));
    expect(wire).not.toMatch(/curves|maxCurves|"spl"|"zmag"/);
    expect(Object.keys(JSON.parse(wire).projects[0].content).sort()).toEqual(['P', 'box', 'driver', 'meta']);
  });

  it('an unreadable or wrong-version snapshot restores nothing rather than half a workspace', () => {
    expect(fromSnapshot({ v: 99, activeId: 'x', projects: [] })).toEqual({ open: [], activeId: null });
    expect(fromSnapshot(null as never)).toEqual({ open: [], activeId: null });
  });
});
