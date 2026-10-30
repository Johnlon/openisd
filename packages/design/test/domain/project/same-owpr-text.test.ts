/** OpenISDProject.sameOwprText: the same project in two texts, the driver's per-read id aside. */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import {ProjectBuilder} from '../../../domain/openisdTransforms.js';
import {withoutDriverId} from '../../../domain/project/projectSerialization.js';
import {OpenISDProject} from '../../../domain/project/openISDProject.js';

const engine = createEngine();

function saved(): OpenISDProject {
  const p = ProjectBuilder.empty(engine);
  p.save();
  return p;
}

function withDriverUuid(text: string, uuid: string): string {
  const session = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(session)) throw new Error(session.join('; '));
  const cloned = session.cloneSession();
  const strip = (id: string) => (project: typeof cloned.saved) =>
    ({...project, driverEmbedding: {...project.driverEmbedding, device: {...project.driverEmbedding.device, uuid: {...project.driverEmbedding.device.uuid, value: id}}}});
  return JSON.stringify({...cloned, saved: strip(uuid)(cloned.saved), edited: cloned.edited === null ? null : strip(uuid)(cloned.edited)});
}

describe('OpenISDProject.sameOwprText', () => {
  it('is true for identical text', () => {
    const text = saved().toOwprText();
    expect(OpenISDProject.sameOwprText(text, text)).toBe(true);
  });

  it('ignores the embedded driver id', () => {
    const text = saved().toOwprText();
    expect(OpenISDProject.sameOwprText(withDriverUuid(text, 'aaaa'), withDriverUuid(text, 'bbbb'))).toBe(true);
  });

  it('ignores the driver id in the edited record too', () => {
    const p = saved();
    p.name.set('edited');
    const text = p.toOwprText();
    expect(OpenISDProject.sameOwprText(withDriverUuid(text, 'aaaa'), withDriverUuid(text, 'bbbb'))).toBe(true);
  });

  it('is false for two different projects', () => {
    const a = saved();
    const b = saved();
    b.name.set('another');
    b.save();
    expect(OpenISDProject.sameOwprText(a.toOwprText(), b.toOwprText())).toBe(false);
  });

  it('is false when either text is unreadable', () => {
    const text = saved().toOwprText();
    expect(OpenISDProject.sameOwprText(text, 'not json')).toBe(false);
    expect(OpenISDProject.sameOwprText('not json', text)).toBe(false);
  });
});

describe('withoutDriverId', () => {
  it('blanks the driver id of the saved record and of the edited one when there is one', () => {
    const p = saved();
    const none = withoutDriverId(p.cloneSession());
    expect(none.saved.driverEmbedding.device.uuid.value).toBe('');
    expect(none.edited).toBeNull();
    p.name.set('edited');
    const both = withoutDriverId(p.cloneSession());
    expect(both.edited?.driverEmbedding.device.uuid.value).toBe('');
  });
});
