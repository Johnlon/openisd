/** The crash id the collector computes: first 24 hex chars of SHA-256 over `version\nmessage\nframes`. */
export async function crashHash(version: string, message: string, frames: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${version}\n${message}\n${frames}`);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
