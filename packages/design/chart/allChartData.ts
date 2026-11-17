import type {ChartId, DriverError} from '../engine/index.js';
import {buildPlotData, type ChartEngineAreas, type ReferenceLineColors, TAB_META} from './series.js';
import {ChartData} from './chartData.js';
import {ZipArchive, type ZipEntry} from './zipArchive.js';
import type {Design} from './types.js';

/**
 * Every chart the open project can draw as a CSV, plus the project file itself, in one ZIP:
 * "<project> - all chart data.zip". A chart with no plot (blocked by an error) has no CSV.
 */
export class AllChartData {
  private constructor(
    readonly zipName: string,
    readonly files: readonly ZipEntry[],
    readonly chartCount: number,
  ) {}

  static of(
    projectName: string,
    charts: readonly ChartId[],
    engine: ChartEngineAreas,
    fmin: number,
    fmax: number,
    design: Design,
    errors: DriverError[],
    referenceLines: ReferenceLineColors,
    projectText: string,
  ): AllChartData {
    const csvs: ZipEntry[] = [];
    for (const id of charts) {
      const plot = buildPlotData(engine, id, fmin, fmax, design, [], errors, {bare: false, primaryColor: design.color, referenceLines}).value;
      if (!plot) continue;
      const data = ChartData.of(TAB_META[id].name, plot);
      csvs.push({name: data.fileName(projectName), text: data.csv()});
    }
    return new AllChartData(
      ChartData.safeFileName(`${projectName} - all chart data.zip`),
      [...csvs, {name: 'project.json', text: projectText}],
      csvs.length,
    );
  }

  /** The ZIP file's bytes. */
  zip(): Uint8Array<ArrayBuffer> {
    return ZipArchive.store(this.files);
  }
}
