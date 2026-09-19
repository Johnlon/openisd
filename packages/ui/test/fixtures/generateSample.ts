import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Engine, OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject} from '@openisd/design';
import {SAMPLE_PROJECT_OWPR} from './sampleProject.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const driverStr = readFileSync(join(__dirname, '../../public/drivers/tang-band/w5-1138smf.json'), 'utf-8');
const driverJson = JSON.parse(driverStr);
const engine = new Engine();
const maybeDriver = OpenISDDriver.fromConformingRecord(driverJson, engine);
if (Array.isArray(maybeDriver)) {
    throw new Error(`fixture driver is not conforming: ${maybeDriver.join(', ')}`);
}
const driver = maybeDriver;

const builder = OpenISDProject.builder(driver, engine);

const project = builder.vented().volume_m3(0.007).tuning_hz(35).build();
project.name.set("W5-1138SMF Fixture");
project.box.vented.vent.diameter_m.set(0.05);
project.box.passiveRadiator.configurePR(OpenISDPassiveRadiatorStandalone.empty(engine));
project.envTempK.set(293.15);
project.envPressurePa.set(101325);
project.envHumidityPct.set(50);

project.save();
const owprText = project.toOwprText();
mkdirSync(dirname(SAMPLE_PROJECT_OWPR), { recursive: true });
writeFileSync(SAMPLE_PROJECT_OWPR, owprText);
console.log(`Generated ${SAMPLE_PROJECT_OWPR}`);
