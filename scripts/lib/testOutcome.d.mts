export interface ReportTest {
  title: string;
  file: string | undefined;
  status: string;
  resultStatus: string | undefined;
  unexpected: boolean;
}
export function isUnexpectedEvent(event: {status?: string; expected?: boolean}): boolean;
export function isUnexpectedReportTest(test: {status?: string; results?: {status: string}[]}): boolean;
export function reportTests(report: unknown): ReportTest[];
export interface TestEndEvent {
  event: 'test-end';
  file: string;
  title: string;
  status: string;
  expected: boolean;
}
export function testEndEvents(text: string): TestEndEvent[];
