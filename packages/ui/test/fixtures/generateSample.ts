import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenISDProject, OpenISDDriver, Engine } from '@openisd/design';

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
project.box.vented.vent.diameter_m.set(0.1);
project.envTempK.set(293.15);
project.envPressurePa.set(101325);
project.envHumidityPct.set(50);

project.save();
const owprText = project.toOwprText();
writeFileSync(join(__dirname, 'sample-project.owpr'), owprText);
console.log("Generated sample-project.owpr");
