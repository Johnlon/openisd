/**
 * Every driver/project file the app reads or writes: WinISD's `.wdr`/`.wpr`, our own
 * `.owdr`/`.owpr`. One function per operation, and each one is the domain's own text method for
 * that format — `toWdrIniText`/`DriverRecordConverter`, `toWprText`/`WinIsdProjectConverter`,
 * `toOwdrText`/`fromOwdrText` — except `.owpr` reading, which goes through the injected project
 * repo. This module converts text to bytes and problems to `DriverError`s; it never assembles a
 * format object itself.
 *
 * `applicationIO.ts` is the only caller: it owns filename bookkeeping and the flash
 * messages; this module owns the format conversion. Nothing here touches app state or the
 * DOM.
 */
import {OpenISDDriver, type OpenISDDriverStandalone, OpenISDPassiveRadiatorStandalone, OpenISDProject, DriverRecordConverter, WinIsdProjectConverter, type LoadRepairNote} from '@openisd/design';
import {DriverFileFormat, ProjectFileFormat} from '../fileFormat.js';
import type {DriverError, Engine} from '@openisd/design/engine';
import type {ExportedFiles, ProjectRepo} from '@openisd/persistence';

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

/** Reads every driver/project file format into a domain object, with the one engine the
 *  composition root built and the project repo that brings a stored project up to schema. */
export class DesignFiles {
  readonly #drivers: DriverRecordConverter;
  readonly #projects: WinIsdProjectConverter;

  constructor(
    private readonly engine: Engine,
    private readonly projectRepo: ProjectRepo,
    private readonly exportedFiles: ExportedFiles,
  ) {
    this.#drivers = new DriverRecordConverter(engine);
    this.#projects = new WinIsdProjectConverter(engine);
  }

  /** The current driver as `.owdr` bytes, stamped with the storage layout. Always succeeds — a
   *  driver always has a complete record. */
  driverToOwdrBytes(driver: OpenISDDriver): Uint8Array<ArrayBuffer> {
    return utf8(this.exportedFiles.stamp(driver.toOwdrText()));
  }

  /** A passive radiator as `.owdr` bytes, stamped with the storage layout, as a driver's. */
  passiveRadiatorToOwdrBytes(pr: OpenISDPassiveRadiatorStandalone): Uint8Array<ArrayBuffer> {
    return utf8(this.exportedFiles.stamp(pr.toOwdrText()));
  }

  /** `.owdr` text → a passive radiator, or the reasons it could not be read (a driver's file among them). */
  passiveRadiatorFromText(text: string): OpenISDPassiveRadiatorStandalone | string[] {
    const opened = this.exportedFiles.open(text);
    if (opened.kind === 'newer') return [`this file was saved by a newer OpenISD (its layout ${opened.layout}; this OpenISD reads up to layout ${opened.reads}). Reload this page to get the latest OpenISD, then import it again`];
    return OpenISDPassiveRadiatorStandalone.fromOwdrText(opened.text);
  }

  /** The project as the app saves it to a `.owpr` file (JSON text, stamped with the storage layout). */
  projectToOwprText(project: OpenISDProject): string {
    return this.exportedFiles.stamp(project.toOwprText());
  }

  /** The whole project as WinISD `.wpr` bytes. `value` is null when the project cannot be
   *  expressed in WinISD's format. */
  projectToWprBytes(project: OpenISDProject): Bytes {
    const { value: wpr, errors } = this.#projects.openIsdProjectToWinIsdProject(project);
    return { value: wpr === null ? null : utf8(wpr.toWpr()), errors };
  }

  /** Driver file text → a standalone driver, or the reasons it could not be read. A `.wdr`
   *  goes through the WinISD converter; an `.owdr` IS the app's own record. */
  driverFromText(text: string, format: DriverFileFormat): { value: OpenISDDriverStandalone | null; errors: DriverError[] } {
    if (format === DriverFileFormat.Wdr) return this.#drivers.winIsdDriverToOpenIsdDriver(text);
    const opened = this.exportedFiles.open(text);
    if (opened.kind === 'newer') {
      const message = `this file was saved by a newer OpenISD (its layout ${opened.layout}; this OpenISD reads up to layout ${opened.reads}). The file is unchanged: reload this page to get the latest OpenISD, then open it again`;
      return { value: null, errors: [{ level: 'error', field: 'driver', message }] };
    }
    const result = OpenISDDriver.fromOwdrText(opened.text, this.engine);
    if (Array.isArray(result)) {
      return { value: null, errors: result.map(message => ({ level: 'error', field: 'driver', message })) };
    }
    return { value: result, errors: [] };
  }

  /** Project file text → a project, or the reasons it could not be read. A `.wpr` goes
   *  through the WinISD converter; an `.owpr` is brought up to the current schema by the
   *  persistence layer. `loadRepairs` is every value the load repaired, for the opening message. */
  projectFromText(text: string, format: ProjectFileFormat): { value: OpenISDProject | null; errors: DriverError[]; loadRepairs: readonly LoadRepairNote[]; notes?: readonly string[] } {
    if (format === ProjectFileFormat.Wpr) return this.#projects.winIsdProjectToOpenIsdProject(text);
    const result = this.projectRepo.openProjectText(text);
    if (Array.isArray(result)) {
      return { value: null, errors: result.map(message => ({ level: 'error', field: 'project', message })), loadRepairs: [] };
    }
    return { value: result.project, errors: [], loadRepairs: result.loadRepairs };
  }
}
