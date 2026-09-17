import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { OpenISDProject, OpenISDDriver } from '../../../design/domain/openisdDomain.ts';
import { Engine } from '../../../design/engine/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const driverStr = readFileSync(join(__dirname, '../../public/drivers/tang-band/w5-1138smf.json'), 'utf-8');
const driverJson = JSON.parse(driverStr);
const engine = new Engine();
const driver = OpenISDDriver.fromConformingRecord(driverJson, engine);

const builder = OpenISDProject.builder(driver, engine, {
    username: 'testuser',
    tempK: 293.15,
    pressurePa: 101325,
    humidityPct: 50,
    newId: () => randomUUID()
});

const project = builder.vented().volume_m3(0.007).tuning_hz(35).build();
project.name.set("W5-1138SMF Fixture");
project.box.vented.vent.diameter_m.set(0.1);

project.save();
const owprText = project.toOwprText();
writeFileSync(join(__dirname, 'sample-project.owpr'), owprText);
console.log("Generated sample-project.owpr");
