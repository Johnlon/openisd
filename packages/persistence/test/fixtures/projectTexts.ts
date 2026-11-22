/** Project texts (`.owpr`) for the stored-record tests. */
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

/** A saved project named `name` with one field the schema refuses. */
export function projectWithABadField(name: string): string {
  const project = ProjectBuilder.empty(engine);
  project.name.set(name);
  project.portVelocityLimit_m_per_s.set(25);
  project.save();
  const text = project.toOwprText();
  const broken = text.replace(/"portVelocityLimit_m_per_s":\s*25/, '"portVelocityLimit_m_per_s": "fast"');
  if (broken === text) throw new Error('fixture did not break the field');
  return broken;
}

/** A bandpass4 project carrying retired front chamber losses.Qicl. */
export function projectWithFrontQicl(name: string): string {
  const project = new ProjectBuilder(OpenISDDriver.empty(engine), engine).bandpass4().build();
  project.name.set(name);
  project.save();
  const text = project.toOwprText();
  const broken = text.replace(
    /"front":\s*\{([^}]*"losses":\s*\{)/,
    '"front": {$1 "Qicl": 77, '
  );
  if (broken === text) throw new Error('fixture did not inject front Qicl');
  return broken;
}

export function goodProjectText(name: string): string {
  const project = ProjectBuilder.empty(engine);
  project.name.set(name);
  project.save();
  return project.toOwprText();
}

