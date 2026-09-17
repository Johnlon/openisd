const fs = require('node:fs');
const path = require('node:path');

// We have to use dynamic import because @openisd/design is ESM-only or we are in CommonJS
async function generate() {
    const { OpenISDProject, OpenISDDriver } = await import('../../../design/dist/domain/openisdDomain.js');
    const { Engine } = await import('../../../design/dist/engine/index.js');
    const { randomUUID } = await import('node:crypto');

    const driverStr = fs.readFileSync(path.join(__dirname, '../../public/drivers/tang-band/w5-1138smf.json'), 'utf-8');
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
    
    // Create vented box with 7L volume, 35Hz tuning to match previous fixture exactly
    const project = builder.vented().volume_m3(0.007).tuning_hz(35).build();
    project.name.set("W5-1138SMF Fixture");
    
    // The serialize() method returns OpenISDProjectJson, but toOwprText gives the file format
    const owprText = project.toOwprText();
    
    // Write it back exactly where the old static file was (so we don't need to change fixtures.ts yet)
    fs.writeFileSync(path.join(__dirname, 'sample-project.owpr'), owprText);
    console.log("Generated sample-project.owpr");
}

generate().catch(e => { console.error(e); process.exit(1); });
