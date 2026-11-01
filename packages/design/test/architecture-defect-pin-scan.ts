/**
 * The scan behind `architecture-tests-never-pin-a-defect.test.ts`: finds test text that holds a
 * defect in place. Pure: it takes file text and returns findings.
 */
export interface TestFile {
  readonly path: string;
  readonly text: string;
}

const BUG_FILE = /BUG_/;
const FAILS_CALL = /\b(?:it|test)\.fails\s*\(/;
const PIN_PHRASES: readonly RegExp[] = [
  /known defect/i, /known bug/i, /documents the bug/i, /pins the bug/i, /current \(wrong\)/i, /asserts the throw/i,
];

/** Each `it.fails` / `test.fails` needs `BUG_` on its line, or on the line before or after (a comment). */
export function failsWithoutBugFile(file: TestFile): readonly string[] {
  const lines = file.text.split('\n');
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (!FAILS_CALL.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const near = [lines[i - 1], line, lines[i + 1]].filter((l): l is string => l !== undefined);
    if (!near.some((l) => BUG_FILE.test(l))) found.push(`${file.path}:${i + 1}: it.fails without a BUG_ file named`);
  });
  return found;
}

/** A line using a "this is a known defect" phrase must name the `BUG_` file on that same line. */
export function pinPhrasesWithoutBugFile(file: TestFile): readonly string[] {
  const found: string[] = [];
  file.text.split('\n').forEach((line, i) => {
    if (PIN_PHRASES.some((p) => p.test(line)) && !BUG_FILE.test(line)) found.push(`${file.path}:${i + 1}: defect-pinning phrase without a BUG_ file`);
  });
  return found;
}

/** A skip is a fail (TESTING_STRATEGY): a skipped, todo or fixme test is deleted, fixed, or made an `it.fails` naming its bug. */
const SKIP_CALL = /\b(?:it|test|describe)\.(?:skip|todo|fixme)\b|\b(?:xit|xtest|xdescribe)\s*\(/;

export function skippedTests(file: TestFile): readonly string[] {
  const found: string[] = [];
  file.text.split('\n').forEach((line, i) => {
    if (SKIP_CALL.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) found.push(`${file.path}:${i + 1}: skipped test (a skip is a fail)`);
  });
  return found;
}

export function defectPinFindings(files: readonly TestFile[]): readonly string[] {
  return files.flatMap((f) => [...failsWithoutBugFile(f), ...pinPhrasesWithoutBugFile(f), ...skippedTests(f)]);
}
