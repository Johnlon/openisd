import type { DriverSpecsSection } from '../openisdSchema.js';

/** The names of a driver's spec fields — the schema's own keys. */
export type DriverSpecFieldName = keyof DriverSpecsSection;
