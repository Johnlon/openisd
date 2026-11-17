import type {Page} from '@playwright/test';
import {COMPLETE_DRIVER_PROJECT_OWPR, openAMobileProject, openAProject} from '../fixtures.js';
import {forceMobileSkin} from './mobileSkin.js';
import {MOBILE_SURFACES, MobileRoute} from './mobileSurfaceManifest.js';
import {openMobileSurface} from './mobileSurfaceNavigation.js';
import {DESKTOP_SURFACES, DesktopRoute} from './desktopSurfaceManifest.js';
import {openDesktopSurface} from './desktopSurfaceNavigation.js';
import {VIEW_INDEX, ViewSkin} from './viewIndex.js';
import type {ViewEntry} from './viewIndex.js';
import {EXTRA_OPEN_STEPS, VIEW_REASONS} from './viewOpenSteps.js';
import {NoOpenReason, WALK_VIEWPORT, WalkSkin} from './viewOpenTypes.js';
import type {OpenStep, ViewPlan} from './viewOpenTypes.js';
export {NO_OPEN_WHY, NoOpenReason, WALK_VIEWPORT, WalkSkin} from './viewOpenTypes.js';
export type {OpenStep, ViewPlan} from './viewOpenTypes.js';

/**
 * How one view of the view index is opened for a measuring spec (T763). One module, shared by the layout
 * walk and, later, the live review. Every (view, skin) either has an open() step that drives the real
 * screen as a user does, or one reason from NoOpenReason. The number of reasons may only go down.
 */
export function skinsOf(view: ViewEntry): readonly WalkSkin[] {
  switch (view.skin) {
    case ViewSkin.Phone: return [WalkSkin.Phone];
    case ViewSkin.Desktop: return [WalkSkin.Desktop];
    case ViewSkin.Both: return [WalkSkin.Phone, WalkSkin.Desktop];
  }
}

/** The page with a complete project open, in the skin and window size of the walk. */
export async function startWalk(page: Page, skin: WalkSkin): Promise<void> {
  await page.setViewportSize(WALK_VIEWPORT[skin]);
  switch (skin) {
    case WalkSkin.Phone:
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      return;
    case WalkSkin.Desktop:
      await page.goto('/');
      await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      return;
  }
}

function derivedStep(view: ViewEntry, skin: WalkSkin): OpenStep | undefined {
  switch (skin) {
    case WalkSkin.Phone: {
      const surface = MOBILE_SURFACES.find(candidate => candidate.id === view.id);
      if (surface === undefined || surface.route === MobileRoute.Manual) return undefined;
      return {root: surface.root, open: page => openMobileSurface(page, surface)};
    }
    case WalkSkin.Desktop: {
      const surface = DESKTOP_SURFACES.find(candidate => candidate.id === view.id);
      if (surface === undefined || surface.route === DesktopRoute.Cloud) return undefined;
      return {root: surface.root, open: page => openDesktopSurface(page, surface)};
    }
  }
}

/** A step with no root of its own measures the whole body; the console errors its own fault writes are listed for the browser-log check. */
function withRoot(step: OpenStep): Omit<Extract<ViewPlan, {kind: 'open'}>, 'kind'> {
  return {root: step.root === '' ? 'body' : step.root, open: step.open, ownConsoleErrors: step.expectedConsoleError === undefined ? [] : [step.expectedConsoleError]};
}

/** The plan for one view in one skin: an extra step, a derived step, or a reason. */
export function planFor(view: ViewEntry, skin: WalkSkin): ViewPlan {
  const named = VIEW_REASONS.get(`${skin}:${view.id}`);
  if (named !== undefined) return {kind: 'reason', reason: named};
  const extra = EXTRA_OPEN_STEPS.get(`${skin}:${view.id}`);
  if (extra !== undefined) return {kind: 'open', ...withRoot(extra)};
  const derived = derivedStep(view, skin);
  if (derived !== undefined) return {kind: 'open', ...withRoot(derived)};
  return {kind: 'reason', reason: VIEW_REASONS.get(`${skin}:${view.id}`) ?? NoOpenReason.StepNotWritten};
}

/** Every (view, skin) the walk covers. */
export function walkTargets(): readonly {readonly view: ViewEntry; readonly skin: WalkSkin; readonly plan: ViewPlan}[] {
  return VIEW_INDEX.flatMap(view => skinsOf(view).map(skin => ({view, skin, plan: planFor(view, skin)})));
}

/** Only the targets that have an open step, with the plan narrowed to it. */
export function openTargets(): readonly {readonly view: ViewEntry; readonly skin: WalkSkin; readonly plan: Extract<ViewPlan, {kind: 'open'}>}[] {
  return walkTargets().flatMap(({view, skin, plan}) => plan.kind === 'open' ? [{view, skin, plan}] : []);
}

/** The smallest gap between a number box and its up/down buttons the walk asks for: John's phone ruling (10 Nov 2026); desktop spinners are the slim 18 px ones and ask for none. */
export function stepperGapFor(skin: WalkSkin, phoneGapPx: number): number {
  switch (skin) {
    case WalkSkin.Phone: return phoneGapPx;
    case WalkSkin.Desktop: return 0;
  }
}
