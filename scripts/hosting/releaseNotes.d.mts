export interface Commit { subject: string; files: string[] }
export function leaks(text: string): boolean;
export function taskKeysOf(subject: string): string[];
export function releaseNoteOf(taskText: string): string | null;
export function bugSentenceOf(bugText: string): string | null;
export function notesOf(commits: readonly Commit[], readTask: (key: string) => string | null, readBug: (path: string) => string | null): string;
export function headlineOf(markdown: string): string;
export function commitsIn(from: string, to: string): Commit[];
