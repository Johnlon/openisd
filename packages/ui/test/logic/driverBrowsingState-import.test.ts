import {afterEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {ref} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {
  createBundledDriverRepo,
  createFileStorage,
  createMemoryStorage,
  createMyDriverRepo,
  createPrefsRepo,
  createProjectRepo,
} from '@openisd/persistence';
import type {Logging} from '../../src/logging/flash.js';
import {createDriverSelection} from '../../src/logic/driverSelection.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import {DesignFiles, driverToWdrBytes} from '../../src/logic/fileImportExport.js';
import {ProjectFileFormat} from '../../src/fileFormat.js';

/** John, 2026-10-05: a driver file loaded into My Drivers says so, naming the driver; one that
 *  cannot be loaded says why, naming the file. */
describe('My Drivers Load File flashes what it did', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const GOLDEN_SEALED = join(here, '..', '..', '..', 'design', 'test', 'winisd', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');

  class FakeInput { value = 'picked'; constructor(readonly files: File[]) {} }

  afterEach(() => { vi.unstubAllGlobals(); });

  function setUp() {
    const engine = createEngine();
    const storage = createMemoryStorage();
    const files = new DesignFiles(engine, createProjectRepo(engine, createFileStorage(), storage));
    const logging: Logging = { message: ref(''), flash: vi.fn() };
    const browsing = createDriverBrowsingState({
      driverRepo: createBundledDriverRepo({
        fetch: () => Promise.reject(new Error('fetch not used')), baseUrl: '/', engine, maxAge_ms: 1, now: Date.now,
      }),
      myDriverRepo: createMyDriverRepo(storage, engine), prefs: createPrefsRepo(storage), logging,
      selection: createDriverSelection(), files, confirmReset: () => true,
    });
    vi.stubGlobal('HTMLInputElement', FakeInput);
    vi.stubGlobal('FileReader', class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      result: ArrayBuffer | null = null;
      readAsArrayBuffer(file: File): void {
        void file.arrayBuffer().then(buf => { this.result = buf; queueMicrotask(() => this.onload?.()); });
      }
    });
    return { browsing, files, flash: logging.flash };
  }

  async function load(browsing: ReturnType<typeof setUp>['browsing'], file: File): Promise<void> {
    const event = new Event('change');
    Object.defineProperty(event, 'target', { value: new FakeInput([file]) });
    browsing.loadFromDisk(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  it('a .wdr file names the driver it put in My Drivers', async () => {
    const { browsing, files, flash } = setUp();
    const project = files.projectFromText(readFileSync(GOLDEN_SEALED, 'utf8'), ProjectFileFormat.Wpr).value;
    if (!project) throw new Error('the golden must load');
    project.driver.brand.set('Tang Band');
    project.driver.model.set('W5-1138SMF');
    const bytes = driverToWdrBytes(project.driver).value;
    if (!bytes) throw new Error('the golden driver must export');

    await load(browsing, new File([bytes], 'tb.wdr'));

    expect(flash).toHaveBeenCalledWith('Driver imported to My Drivers: Tang Band W5-1138SMF');
  });

  it('a file that is not a driver says why, naming the file', async () => {
    const { browsing, flash } = setUp();
    await load(browsing, new File(['hello'], 'notes.txt'));
    expect(flash).toHaveBeenCalledWith('Could not import notes.txt: it is not a driver file (expected .wdr or .owdr)');
  });
});
