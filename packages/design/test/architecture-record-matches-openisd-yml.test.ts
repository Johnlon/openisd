import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind } from 'ts-morph';

/**
 * `OpenISDDeviceJson` IS the openisd.yml file, declared as a type. This is the only check that
 * the two agree — without it the type can silently model a subset, which is what happened: it
 * carried four of the sixteen keys a record actually has, so `data_sources` (the datasheet and
 * product links) and `driver_type` (what the filter chips classify on) had nowhere to live.
 *
 * The two lists below come from the pydantic model that WRITES the record — `OpenIsdYmlFile` in
 * winisd_tools `scrapers/scrapers/lib/model_openisd.py`, which is `DriverFile`
 * (`model_driver.py`, the driver.yml model) minus `scraper_meta`. A field declared there without
 * a default is required here; one declared `Optional[...] = None` is optional here.
 */
describe('OpenISDDeviceJson matches the openisd.yml record', () => {
  // THE AUTHORITY IS THE PYDANTIC MODEL. `OpenIsdYmlFile` in winisd_tools
  // `scrapers/scrapers/lib/model_openisd.py` writes every openisd.yml and is `extra="forbid"`;
  // it is `DriverFile` (`model_driver.py`, the driver.yml model) minus `scraper_meta`, and both
  // declare the same ten without a default. A field with `Optional[...] = None` is optional.
  //
  // Counting records is NOT a substitute and is not done here: a count cannot distinguish "the
  // model requires it" from "every record we happen to hold has it".
  const ALWAYS = [
    'uuid', 'quality', 'manufacturer', 'brand', 'model', 'sku',
    'driver_type', 'data_sources', 'authoritative', 'specs',
  ];
  const SOMETIMES = [
    'series', 'nominal_size_cm', 'product_image', 'description',
    'surround_material', 'provided_by', 'comment', 'added', 'curves',
  ];

  // Parsed as an AST, not matched with a regex: the schema's entries span multiple lines and
  // nest, and a text pattern that looked right on the simple ones silently misread `curves` and
  // `nominal_size_cm`. ts-morph reads what the compiler reads.
  const members = (): Map<string, boolean> => {
    const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
    const file = project.addSourceFileAtPath(
      fileURLToPath(new URL('../domain/openisdRecordSchema.ts', import.meta.url)));

    const decl = file.getVariableDeclaration('openISDDeviceJsonSchema');
    expect(decl, 'openISDDeviceJsonSchema not found in domain/openisdRecordSchema.ts').toBeDefined();

    // `z.strictObject({ ... })` — the one object literal argument holds every member.
    const call = decl!.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
    const literal = call.getArguments()[0]!.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    const found = new Map<string, boolean>();
    for (const prop of literal.getProperties()) {
      const assignment = prop.asKind(SyntaxKind.PropertyAssignment);
      if (assignment === undefined) continue;
      // A member is OPTIONAL when its schema ends in `.optional()`.
      found.set(assignment.getName().replace(/^'|'$/g, ''),
        /\.optional\(\)$/.test(assignment.getInitializerOrThrow().getText().trim()));
    }
    return found;
  };

  it('declares every key an openisd.yml record carries', () => {
    const declared = new Set(members().keys());
    const missing = [...ALWAYS, ...SOMETIMES].filter(k => !declared.has(k));
    expect(missing, `openisd.yml keys the type does not model: ${missing.join(', ')}`).toEqual([]);
  });

  it('marks a key optional exactly when a record may omit it', () => {
    const m = members();
    const wronglyOptional = ALWAYS.filter(k => m.get(k) === true);
    const wronglyRequired = SOMETIMES.filter(k => m.get(k) === false);
    expect(wronglyOptional, `every record has these, so they are not optional: ${wronglyOptional.join(', ')}`).toEqual([]);
    expect(wronglyRequired, `a record may omit these, so they must be optional: ${wronglyRequired.join(', ')}`).toEqual([]);
  });
});
