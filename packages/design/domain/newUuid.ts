// This package depends on NOTHING — no `@openisd/*`, no DOM lib — which is why `crypto` is not
// already in scope here the way it is in packages that pull ambient browser types in through a
// dependency's `.d.ts`. Minting an id is the one platform capability the domain needs, so it is
// declared explicitly and narrowly, in one place: exactly `randomUUID`, and nothing else. Adding
// `"DOM"` to the package's `lib` would work too and would also put `document`, `window` and the
// whole browser API within reach of domain code, which is the opposite of what this package is.
//
// `crypto.randomUUID()` is a global in browsers and in Node 19+, so this resolves at runtime on
// both without a polyfill or an import.
declare const crypto: { randomUUID(): string };

/** A fresh project identity. See `OpenISDProject`'s `#uuid` for why it never leaves the process. */
export function newUuid(): string {
  return crypto.randomUUID();
}
