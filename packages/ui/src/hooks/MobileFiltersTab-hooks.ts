import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {projectChanged} from '../logic/appState.js';
import {useApp} from '../logic/app.js';
import {OriginalFilters, type OriginalFiltersAPI} from './OriginalFilters-hooks.js';

/**
 * The mobile Filters tab's logic: exactly `OriginalFilters` (`OriginalFilters-hooks.ts`) — the
 * filter chain read/mutated the same way regardless of skin, no mobile-specific state of its
 * own. `OriginalFilters.vue` itself takes this API as a prop and is presentation-only, so it's
 * reused directly (see MobileFiltersTab.vue) rather than duplicating a second Filters UI.
 */
export function useMobileFiltersTab(): OriginalFiltersAPI {
  const project = useFocusedProject();
  const { filters } = useApp().engine;
  return new OriginalFilters(project, projectChanged, filters);
}
