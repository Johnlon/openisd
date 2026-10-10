import {OpenISDProject} from '@openisd/design';
import type {Engine} from '@openisd/design/engine';

export interface ProjectArchive {
  version: 1;
  projects: { text: string }[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isProjectArchive(obj: unknown): obj is ProjectArchive {
  if (!isRecord(obj)) return false;
  if (obj.version !== 1) return false;
  if (!Array.isArray(obj.projects)) return false;
  for (const p of obj.projects) {
    if (!isRecord(p) || typeof p.text !== 'string') return false;
  }
  return true;
}

export type ArchiveParseResult = 
  | { kind: 'parsed'; projects: OpenISDProject[] }
  | { kind: 'failed'; reason: string };

export function buildProjectsArchive(projects: readonly OpenISDProject[]): string {
  const archive: ProjectArchive = {
    version: 1,
    projects: projects.map(p => ({ text: p.toOwprText() }))
  };
  return JSON.stringify(archive);
}

export function parseProjectsArchive(bytes: Uint8Array | string, engine: Engine): ArchiveParseResult {
  let text = '';
  if (typeof bytes === 'string') {
    text = bytes;
  } else {
    try {
      text = new TextDecoder().decode(bytes);
    } catch {
      return { kind: 'failed', reason: 'not valid UTF-8' };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'failed', reason: 'not valid JSON' };
  }
  
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) {
    return { kind: 'failed', reason: 'not a project archive' };
  }
  
  if (!isProjectArchive(parsed)) {
    if (isRecord(parsed) && parsed.version !== 1) {
      return { kind: 'failed', reason: `unsupported version: ${String(isRecord(parsed) ? parsed.version : '')}` };
    }
    return { kind: 'failed', reason: 'archive is malformed' };
  }
  
  const projects: OpenISDProject[] = [];
  for (const p of parsed.projects) {
    const proj = OpenISDProject.fromOwprText(p.text, engine);
    if (Array.isArray(proj)) {
      return { kind: 'failed', reason: `could not parse a project: ${proj[0]}` };
    }
    projects.push(proj);
  }
  return { kind: 'parsed', projects };
}
