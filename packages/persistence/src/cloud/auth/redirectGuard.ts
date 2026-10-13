export interface RedirectLocation {
  assign(url: string): void;
}

export interface RedirectGuardDeps {
  readonly commitFocusedField: () => void;
  readonly flushPendingSaves: () => void;
  readonly recordOpenProjectId: () => void;
  readonly location: RedirectLocation;
}

export interface RedirectGuard {
  leave(url: string): void;
}

export function createRedirectGuard(deps: RedirectGuardDeps): RedirectGuard {
  return {
    leave(url: string): void {
      deps.commitFocusedField();
      deps.flushPendingSaves();
      deps.recordOpenProjectId();
      deps.location.assign(url);
    },
  };
}
