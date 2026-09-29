/**
 * Every driver/project file the app reads or writes: WinISD's `.wdr`/`.wpr`, our own
 * `.owdr`/`.owpr`. One function per operation, and each one is the domain's own text method for
 * that format — `toWdrIniText`/`WinIsdDriverConverter`, `toWprText`/`WinIsdProjectConverter`,
 * `toOwdrText`/`fromOwdrText` — except `.owpr` reading, which goes through the injected project
 * repo. This module converts text to bytes and problems to `DriverError`s; it never assembles a
 * format object itself.
 *
 * `useApplicationIO.ts` is the only caller: it owns filename bookkeeping and the flash
 * messages; this module owns the format conversion. Nothing here touches app state or the
 * DOM.
 */
import {OpenISDDriver, OpenISDProject, WinIsdDriverConverter, WinIsdProjectConverter} from '@openisd/design';
import {DriverFileFormat, ProjectFileFormat} from '../fileFormat.js';
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

/** Reads every driver/project file format into a domain object, with the one engine the
 *  composition root built and the project repo that brings a stored project up to schema. */
export class DesignFiles {
  readonly #drivers: WinIsdDriverConverter;
  readonly #projects: WinIsdProjectConverter;

  constructor(private readonly engine: Engine, private readonly projectRepo: ProjectRepo) {
    this.#drivers = new WinIsdDriverConverter(engine);
    this.#projects = new WinIsdProjectConverter(engine);
  }

  /** The whole project as WinISD `.wpr` bytes. `value` is null when the project cannot be
   *  expressed in WinISD's format. */
  projectToWprBytes(project: OpenISDProject): Bytes {
    const { value: wpr, errors } = this.#projects.openIsdProjectToWinIsdProject(project);
    return { value: wpr === null ? null : utf8(wpr.toWpr()), errors };
  }

  /** Driver file text → a standalone driver, or the reasons it could not be read. A `.wdr`
   *  goes through the WinISD converter; an `.owdr` IS the app's own record. */
  driverFromText(text: string, format: DriverFileFormat): { value: OpenISDDriver | null; errors: DriverError[] } {
    if (format === DriverFileFormat.Wdr) return this.#drivers.winIsdDriverToOpenIsdDriver(text);
    const result = OpenISDDriver.fromOwdrText(text, this.engine);
    if (Array.isArray(result)) {
      return { value: null, errors: result.map(message => ({ level: 'error', field: 'driver', message })) };
    }
    return { value: result, errors: [] };
  }

  /** Project file text → a project, or the reasons it could not be read. A `.wpr` goes
   *  through the WinISD converter; an `.owpr` is brought up to the current schema by the
   *  persistence layer. */
  projectFromText(text: string, format: ProjectFileFormat): { value: OpenISDProject | null; errors: DriverError[] } {
    if (format === ProjectFileFormat.Wpr) return this.#projects.winIsdProjectToOpenIsdProject(text);
    const result = this.projectRepo.readProjectText(text);
    if (Array.isArray(result)) {
      return { value: null, errors: result.map(message => ({ level: 'error', field: 'project', message })) };
    }
    return { value: result, errors: [] };
  }
}
