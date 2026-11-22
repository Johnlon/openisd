import type { Reporter, TestCase, TestModule } from 'vitest/node';

export default class TimingVitestReporter implements Reporter {
  onTestModuleStart(module: TestModule): void {
    console.log(`SPEC START ${module.moduleId.replace(process.cwd() + '/', '')}`);
  }

  onTestModuleEnd(module: TestModule): void {
    const file = module.moduleId.replace(process.cwd() + '/', '');
    const duration = module.diagnostic().duration;
    const ok = module.state() !== 'failed';
    console.log(`SPEC END ${file} status=${ok ? 'passed' : 'failed'} duration_ms=${duration}`);
  }

  onTestCaseReady(testCase: TestCase): void {
    console.log(`TEST START ${testCase.fullName}`);
  }

  onTestCaseResult(testCase: TestCase): void {
    const duration = testCase.diagnostic()?.duration ?? 0;
    console.log(`TEST END ${testCase.fullName} status=${testCase.result().state} duration_ms=${duration}`);
  }
}
