/**
 * Every driver/project file the app reads or writes: WinISD's `.wdr`/`.wpr`, our own
 * `.owdr`/`.owpr`. One function per operation, and each one is the domain's own text method for
 * that format — `toWdrIniText`/`fromWdrIniText`, `toWprText`/`fromWprText`,
 * `toOwdrText`/`fromOwdrText` — except `.owpr` reading, which goes through the injected project
 * repo. This module converts text to bytes and problems to `DriverError`s; it never assembles a
 * format object itself.
 *
 * `useApplicationIO.ts` is the only caller: it owns filename bookkeeping and the flash
 * messages; this module owns the format conversion. Nothing here touches app state or the
 * DOM.
 */
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import type {DriverError, Engine} from '@openisd/design/engine';
import type {ProjectRepo} from '@openisd/persistence';

export interface Bytes {
  value: Uint8Array<ArrayBuffer> | null;
  errors: DriverError[];
}

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

/** The current driver as WinISD `.wdr` bytes. `value` is null when the driver is too
 *  incomplete for WinISD's format — the first `errors` entry says which field. */
export function driverToWdrBytes(driver: OpenISDDriver): Bytes {
  const { value, errors } = driver.toWdrIniText();
  return { value: value === null ? null : utf8(value), errors };
}

/** The current driver as `.owdr` bytes (openisd driver YAML). Always succeeds — a driver
 *  always has a complete record. */
export function driverToOwdrBytes(driver: OpenISDDriver): Uint8Array<ArrayBuffer> {
  return utf8(driver.toOwdrText());
}

/** The whole project as WinISD `.wpr` bytes. `value` is null when the project cannot be
 *  expressed in WinISD's format. */
export function projectToWprBytes(project: OpenISDProject): Bytes {
  const { value, errors } = project.toWprText();
  return { value: value === null ? null : utf8(value), errors };
}

/** Reads every driver/project file format into a domain object, with the one engine the
 *  composition root built and the project repo that brings a stored project up to schema. */
export class DesignFiles {
  constructor(private readonly engine: Engine, private readonly projectRepo: ProjectRepo) {}

  /** `.wdr` text → a standalone driver, or the reasons it could not be read. */
  wdrTextToDriver(text: string): { value: OpenISDDriver | null; errors: DriverError[] } {
  return OpenISDDriver.fromWdrIniText(text, this.engine);
  }

  /** `.owdr` text → a standalone driver, or the reasons it could not be read. */
  owdrTextToDriver(text: string): { value: OpenISDDriver | null; errors: DriverError[] } {
  const result = OpenISDDriver.fromOwdrText(text, this.engine);
  if (Array.isArray(result)) {
    return { value: null, errors: result.map(message => ({ level: 'error', field: 'driver', message })) };
  }
  return { value: result, errors: [] };
  }

  /** `.wpr` text → a new project, or the reasons it could not be read. */
  wprTextToProject(text: string): { value: OpenISDProject | null; errors: DriverError[] } {
  return OpenISDProject.fromWprText(text, this.engine);
  }

  /** `.owpr` text → a project, brought up to the current schema by the persistence layer. */
  owprTextToProject(text: string): { value: OpenISDProject | null; errors: DriverError[] } {
  const result = this.projectRepo.readProjectText(text);
  if (Array.isArray(result)) {
    return { value: null, errors: result.map(message => ({ level: 'error', field: 'project', message })) };
  }
  return { value: result, errors: [] };
  }
}
