import type {BranchMap} from './types.js';
import {DESKTOP_BRANCH_MAP} from './desktop.js';
import {PHONE_BRANCH_MAP} from './phone.js';
import {SHARED_BRANCH_MAP} from './shared.js';
export type {Mapping,BranchMap} from './types.js';
export {DESKTOP_BRANCH_MAP,PHONE_BRANCH_MAP,SHARED_BRANCH_MAP};
export const BRANCH_MAP:BranchMap=Object.freeze({...PHONE_BRANCH_MAP,...DESKTOP_BRANCH_MAP,...SHARED_BRANCH_MAP});
