import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Engine, OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject} from '@openisd/design';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '@openisd/design/fields';
import {COMPLETE_DRIVER_PROJECT_OWPR, SAMPLE_PROJECT_OWPR} from './sampleProject.js';

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

// WinISD's default vented alignment (C4/SC4), designed as the New Project wizard does it
// (docs/research/VENTED_ALIGNMENT_FORMULAS.md); a hardcoded volume/tuning here would drift from
// what the wizard actually builds for this driver. Ql 10 is the new-project vented default.
const qtsLoaded = engine.sourceLoadedQts(
  driver.specs.Qms.value!, driver.specs.Qes.value!, driver.specs.Re_ohm.value!, DEFAULT_SOURCE_RESISTANCE_OHM, driver.specs.Qts.value!,
);
const c4 = engine.ventedAlignment('c4', driver.specs.Fs_hz.value!, qtsLoaded, driver.specs.Vas_m3.value!, 10);
const project = builder.vented().volume_m3(c4.Vb).tuning_goal_hz(c4.Fb).build();
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

// Generate complete driver project with zero consistency issues
const completeRecord = JSON.parse(driverStr);
completeRecord.brand.value = 'Fixture';
completeRecord.model.value = 'Test Driver';
const qts = 0.38;
const qms = 4.5;
const qes = (qts * qms) / (qms - qts);

// Each reading states its own `read_precision` (D13), because the stored SI number cannot: JSON
// drops trailing zeros, so a Vas read off a datasheet as "30.0 L" arrives as `0.03` and would
// otherwise be taken to state ±0.005 m³ — five litres. Every figure below is stated the way a
// datasheet states it, in the unit it is quoted in, converted to SI:
//   Fs 37 Hz ±0.5   Vas 30.0 L ±0.05 L   Sd 212 cm² ±0.5 cm²   Le 0.80 mH ±0.005 mH
//   Xmax 6.0 mm ±0.05 mm   Re 6.6 Ω ±0.05   Pe 150 W ±0.5   Znom 8 Ω ±0.5
completeRecord.specs.woofer = {
  Fs_hz: { state: 'E', value: 37, origin: 'entered', readings: { entered: { read_value: 37, read_precision: 0.5 } } },
  Qts: { state: 'E', value: qts, origin: 'entered', readings: { entered: { read_value: qts, read_precision: 0.005 } } },
  Qms: { state: 'E', value: qms, origin: 'entered', readings: { entered: { read_value: qms, read_precision: 0.05 } } },
  Qes: { state: 'E', value: qes, origin: 'entered', readings: { entered: { read_value: qes, read_precision: 0.005 } } },
  Vas_m3: { state: 'E', value: 0.03, origin: 'entered', readings: { entered: { read_value: 0.03, read_precision: 0.00005 } } },
  Sd_m2: { state: 'E', value: 0.0212, origin: 'entered', readings: { entered: { read_value: 0.0212, read_precision: 0.00005 } } },
  Re_ohm: { state: 'E', value: 6.6, origin: 'entered', readings: { entered: { read_value: 6.6, read_precision: 0.05 } } },
  Le_H: { state: 'E', value: 0.0008, origin: 'entered', readings: { entered: { read_value: 0.0008, read_precision: 0.000005 } } },
  Xmax_m: { state: 'E', value: 0.006, origin: 'entered', readings: { entered: { read_value: 0.006, read_precision: 0.00005 } } },
  Pe_W: { state: 'E', value: 150, origin: 'entered', readings: { entered: { read_value: 150, read_precision: 0.5 } } },
  Znom_ohm: { state: 'E', value: 8, origin: 'entered', readings: { entered: { read_value: 8, read_precision: 0.5 } } }
};

const completeDriver = OpenISDDriver.fromConformingRecord(completeRecord, engine);
if (Array.isArray(completeDriver)) {
    throw new Error(`complete driver is not conforming: ${completeDriver.join(', ')}`);
}

const completeBuilder = OpenISDProject.builder(completeDriver, engine);
const completeProject = completeBuilder.vented().volume_m3(0.03).tuning_goal_hz(35).build();
completeProject.name.set("Complete Fixture Project");
completeProject.box.vented.vent.diameter_m.set(0.05);
completeProject.box.passiveRadiator.configurePR(OpenISDPassiveRadiatorStandalone.empty(engine));
completeProject.envTempK.set(293.15);
completeProject.envPressurePa.set(101325);
completeProject.envHumidityPct.set(50);

completeProject.save();
const completeOwprText = completeProject.toOwprText();
writeFileSync(COMPLETE_DRIVER_PROJECT_OWPR, completeOwprText);
console.log(`Generated ${COMPLETE_DRIVER_PROJECT_OWPR}`);
