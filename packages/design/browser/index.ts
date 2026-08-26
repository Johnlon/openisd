// The platform-bound entry point (`@openisd/design/browser`). Everything reachable from here
// NEEDS A BROWSER, or is the in-memory stand-in for when there isn't one. The pure domain entry
// point (`@openisd/design`) never reaches this file, which is what keeps it runnable in Node.
export { indexedDbStore, memoryStore } from './indexedDbStore.js';
