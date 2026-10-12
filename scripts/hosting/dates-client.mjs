// Runs in the browser on snap/index.html and v/index.html: rewrites each <time data-stamp> from its
// ISO 8601 basic UTC stamp into the design package's local date format. The formatter is the
// design package's own, bundled by scripts/hosting/build-client.mjs — there is no second one.
import {formatDateTime, parseBasicUtc} from '../../packages/design/fields/format.ts';

for (const el of document.querySelectorAll('time[data-stamp]')) {
  const d = parseBasicUtc(el.getAttribute('data-stamp') ?? '');
  if (d !== null) el.textContent = formatDateTime(d);
}
