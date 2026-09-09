import { z } from 'zod';

/**
 * HOW A FIELD'S VALUE CAME TO BE — the ONE declaration, and the only vocabulary any caller sees.
 *
 * A closed set of three, declared once as a schema with the type read back off it, so a member
 * cannot be added to one and forgotten in the other. Written out as names rather than as WinISD's
 * `E`/`C`/`N` letters: those are one FILE FORMAT's encoding, they live inside
 * `winisd/parstate.ts`, and nothing outside that file ever sees one
 * (John, 2026-09-01: hide them "entirely inside the WinISD i/o code").
 */
export const CellStateSchema = z.enum(['entered', 'calculated', 'not-available']);
export type CellState = z.infer<typeof CellStateSchema>;

