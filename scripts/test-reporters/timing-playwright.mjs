export default class TimingPlaywrightReporter {
  onTestBegin(test) {
    const file = test.location?.file?.replace(process.cwd() + '/', '') ?? '';
    const title = test.titlePath().slice(1).join(' > ') || test.title;
    console.log(`TEST START ${file ? file + ' > ' : ''}${title}`);
  }

  onTestEnd(test, result) {
    const file = test.location?.file?.replace(process.cwd() + '/', '') ?? '';
    const title = test.titlePath().slice(1).join(' > ') || test.title;
    console.log(`TEST END ${file ? file + ' > ' : ''}${title} status=${result.status} duration_ms=${result.duration}`);
  }
}
