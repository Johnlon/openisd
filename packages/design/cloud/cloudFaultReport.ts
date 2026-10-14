import {formatDateTime} from '../fields/format.js';
import type {CloudFaultRecord} from './cloudTypes.js';

/** The Cloud sync block of the diagnostics report: the last sync fault in full, or that there is none. */
export function cloudFaultReportLines(record: CloudFaultRecord | null): readonly string[] {
  if (record === null) return ['Cloud sync: no error since the last successful sync'];
  const {fault} = record;
  return [
    'Cloud sync: last error',
    `  time: ${formatDateTime(new Date(record.at_ms))}`,
    `  request: ${fault.operation}`,
    `  HTTP status: ${fault.status}`,
    `  reason: ${fault.reason}`,
    `  reply: ${fault.reply}`,
  ];
}
