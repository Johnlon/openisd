/**
 * Every driver/project file the app reads or writes: WinISD's `.wdr`/`.wpr`, our own
 * `.owdr`/`.owpr`. One function per operation, each calling whatever that format needs — the
 * `@openisd/design/winisd` converters for the WinISD formats, `OpenISDDriver.toOwdrText()` /
 * `OpenISDDriver.fromYml()` for `.owdr`, the injected project repo for `.owpr`.
 *
 * `useApplicationIO.ts` is the only caller: it owns filename bookkeeping and the flash
 * messages; this module owns the format conversion. Nothing here touches app state or the
 * DOM.
 */
import {
  openIsdDriverToWinIsdDriver,
  openIsdProjectToWinIsdProject,
  winIsdDriverTextToOpenIsdDriver,
  winIsdProjectToOpenIsdProject,
} from '@openisd/design/winisd';
import { OpenISDDriver, type OpenISDProject } from '@openisd/design';
import type { DriverError } from '@openisd/design/engine';
import type { ProjectRepo } from '@openisd/persistence';
import { engine } from './appState.js';

export interface Bytes {
  value: Uint8Array<ArrayBuffer> | null;
  errors: DriverError[];
}

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

/** The current driver as WinISD `.wdr` bytes. `value` is null when the driver is too
 *  incomplete for WinISD's format — the first `errors` entry says which field. */
export function driverToWdrBytes(driver: OpenISDDriver): Bytes {
  const errors: DriverError[] = [];
  const wdr = openIsdDriverToWinIsdDriver(driver, engine, errors);
  if (errors.some(e => e.level === 'error')) return { value: null, errors };
  return { value: utf8(wdr.toWdrIni()), errors };
}

/** The current driver as `.owdr` bytes (openisd driver YAML). Always succeeds — a driver
 *  always has a complete record. */
export function driverToOwdrBytes(driver: OpenISDDriver): Uint8Array<ArrayBuffer> {
  return utf8(driver.toOwdrText());
}

/** The whole project as WinISD `.wpr` bytes. `value` is null when the project cannot be
 *  expressed in WinISD's format. */
export function projectToWprBytes(project: OpenISDProject): Bytes {
  const { value, errors } = openIsdProjectToWinIsdProject(project, engine);
  if (!value) return { value: null, errors };
  return { value: utf8(value.toWpr()), errors };
}

/** `.wdr` text → a standalone driver, or the reasons it could not be read. */
export function wdrTextToDriver(text: string): { value: OpenISDDriver | null; errors: DriverError[] } {
  return winIsdDriverTextToOpenIsdDriver(text, engine);
}

/** `.owdr` text → a standalone driver, or the reasons it could not be read. */
export function owdrTextToDriver(text: string): { value: OpenISDDriver | null; errors: DriverError[] } {
  const result = OpenISDDriver.fromYml(text, engine);
  if (Array.isArray(result)) {
    return { value: null, errors: result.map(message => ({ level: 'error', field: 'driver', message })) };
  }
  return { value: result, errors: [] };
}

/** `.wpr` text → a new project, or the reasons it could not be read. */
export function wprTextToProject(text: string): { value: OpenISDProject | null; errors: DriverError[] } {
  return winIsdProjectToOpenIsdProject(text, engine);
}

/** `.owpr` text → a project, brought up to the current schema by the persistence layer. */
export function owprTextToProject(
  projectRepo: ProjectRepo,
  text: string,
): { value: OpenISDProject | null; errors: DriverError[] } {
  const result = projectRepo.readProjectText(text);
  if (Array.isArray(result)) {
    return { value: null, errors: result.map(message => ({ level: 'error', field: 'project', message })) };
  }
  return { value: result, errors: [] };
}
