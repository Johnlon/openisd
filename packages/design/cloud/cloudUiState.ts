import { field } from './syncDoc.js';

export interface CloudUiState {
  readonly launches: number;
  readonly hintDismissed: boolean;
  readonly conflictsSeen: number;
}

export const DEFAULT_CLOUD_UI_STATE: CloudUiState = {
  launches: 0,
  hintDismissed: false,
  conflictsSeen: 0,
};

export function parseCloudUiState(raw: string | null): CloudUiState {
  if (raw === null || raw === '') {
    return DEFAULT_CLOUD_UI_STATE;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_CLOUD_UI_STATE;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_CLOUD_UI_STATE;
  }

  const rawLaunches = field(parsed, 'launches');
  const rawHintDismissed = field(parsed, 'hintDismissed');
  const rawConflictsSeen = field(parsed, 'conflictsSeen');

  const launches = typeof rawLaunches === 'number' && Number.isFinite(rawLaunches) && rawLaunches >= 0
    ? Math.floor(rawLaunches)
    : 0;
  const hintDismissed = typeof rawHintDismissed === 'boolean'
    ? rawHintDismissed
    : false;
  const conflictsSeen = typeof rawConflictsSeen === 'number' && Number.isFinite(rawConflictsSeen) && rawConflictsSeen >= 0
    ? Math.floor(rawConflictsSeen)
    : 0;

  return {
    launches,
    hintDismissed,
    conflictsSeen,
  };
}
