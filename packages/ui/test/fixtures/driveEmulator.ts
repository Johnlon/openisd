/**
 * An in-memory Google Drive appDataFolder behind a `fetch`, for tests that run real sync over
 * the real Drive client. It keeps the Drive behaviours sync depends on: a media upload makes a
 * new headRevisionId, a metadata-only PATCH does not; PATCH merges appProperties; the changes
 * feed lists every file touched after a page token. A reply holds only the fields the request's
 * `fields=` names, as Drive's does: no top-level `kind`, no `mimeType`.
 */

interface EmulatedFile {
  readonly id: string;
  readonly name: string;
  revision: number;
  appProperties: Record<string, string>;
  body: string;
  /** Change counter when this file last changed; the changes feed lists files changed after a token. */
  changedAt: number;
}

interface Multipart {
  readonly metadata: unknown;
  readonly media: string;
}

const BOUNDARY_RE = /boundary=(.+)$/;

function urlOf(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers;
  if (headers === undefined) return null;
  return new Headers(headers).get(name);
}

function stringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function fieldOf(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
  return Object.entries(value).find(([k]) => k === key)?.[1];
}

function parseMultipart(body: string, contentType: string): Multipart {
  const match = BOUNDARY_RE.exec(contentType);
  if (match === null) throw new Error(`driveEmulator: no boundary in ${contentType}`);
  const parts = body.split(`--${match[1]}`).slice(1, -1);
  const payloads = parts.map(p => {
    const split = p.indexOf('\r\n\r\n');
    return p.slice(split + 4).replace(/\r\n$/, '');
  });
  if (payloads.length !== 2) throw new Error(`driveEmulator: expected 2 parts, got ${payloads.length}`);
  const [metadataText, media] = payloads;
  return {metadata: JSON.parse(metadataText ?? '{}'), media: media ?? ''};
}

export class DriveEmulator {
  private readonly files = new Map<string, EmulatedFile>();
  private changeCounter = 1;
  private nextFileId = 1;

  /** Every file in the app folder, for assertions. */
  listFiles(): readonly {readonly name: string; readonly appProperties: Readonly<Record<string, string>>}[] {
    return [...this.files.values()].map(f => ({name: f.name, appProperties: {...f.appProperties}}));
  }

  /** Puts a file straight into the app folder, as another build might have written it. */
  seed(name: string, appProperties: Readonly<Record<string, string>>, body: string): void {
    const id = `file-${this.nextFileId++}`;
    this.files.set(id, {id, name, revision: 1, appProperties: {...appProperties}, body, changedAt: this.changeCounter++});
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : '';
    const path = url.pathname;

    if (path === '/drive/v3/changes/startPageToken' && method === 'GET') {
      return this.json({startPageToken: String(this.changeCounter)});
    }
    if (path === '/drive/v3/changes' && method === 'GET') {
      const since = Number(url.searchParams.get('pageToken'));
      const changes = [...this.files.values()]
        .filter(f => f.changedAt >= since)
        .map(f => ({fileId: f.id, removed: false, file: this.metaOf(f)}));
      return this.json({newStartPageToken: String(this.changeCounter), changes});
    }
    if (path === '/drive/v3/about' && method === 'GET') {
      return this.json({user: {emailAddress: 'tester@example.com'}});
    }
    if (path === '/drive/v3/files' && method === 'GET') {
      return this.json({files: [...this.files.values()].map(f => this.metaOf(f))});
    }
    if (path === '/upload/drive/v3/files' && method === 'POST') {
      const part = parseMultipart(body, headerOf(init, 'content-type') ?? '');
      const name = fieldOf(part.metadata, 'name');
      const file: EmulatedFile = {
        id: `file-${this.nextFileId++}`,
        name: typeof name === 'string' ? name : 'untitled',
        revision: 1,
        appProperties: stringRecord(fieldOf(part.metadata, 'appProperties')),
        body: part.media,
        changedAt: this.changeCounter++,
      };
      this.files.set(file.id, file);
      return this.json(this.metaOf(file));
    }

    const fileMatch = /^\/(upload\/)?drive\/v3\/files\/([^/]+)$/.exec(path);
    const file = fileMatch === null ? undefined : this.files.get(decodeURIComponent(fileMatch[2] ?? ''));
    if (fileMatch === null || file === undefined) {
      return new Response(JSON.stringify({error: {code: 404, message: `no route ${method} ${path}`}}), {status: 404});
    }
    const upload = fileMatch[1] !== undefined;

    if (method === 'GET') {
      return url.searchParams.get('alt') === 'media' ? new Response(file.body, {status: 200}) : this.json(this.metaOf(file));
    }
    if (method === 'PATCH' && upload) {
      const part = parseMultipart(body, headerOf(init, 'content-type') ?? '');
      file.appProperties = {...file.appProperties, ...stringRecord(fieldOf(part.metadata, 'appProperties'))};
      file.body = part.media;
      file.revision++;
      file.changedAt = this.changeCounter++;
      return this.json(this.metaOf(file));
    }
    if (method === 'PATCH') {
      file.appProperties = {...file.appProperties, ...stringRecord(fieldOf(JSON.parse(body), 'appProperties'))};
      file.changedAt = this.changeCounter++;
      return this.json(this.metaOf(file));
    }
    if (method === 'DELETE') {
      this.files.delete(file.id);
      this.changeCounter++;
      return new Response(null, {status: 204});
    }
    return new Response(JSON.stringify({error: {code: 405}}), {status: 405});
  };

  private metaOf(f: EmulatedFile): object {
    return {id: f.id, name: f.name, headRevisionId: `rev-${f.revision}`, appProperties: {...f.appProperties}};
  }

  private json(value: object): Response {
    return new Response(JSON.stringify(value), {status: 200, headers: {'content-type': 'application/json'}});
  }
}
