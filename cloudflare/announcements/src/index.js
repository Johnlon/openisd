const ANNOUNCEMENTS = [
  {
    id: 'openisd-7.0.957',
    version: '7.0.957',
    published: '2026-10-26',
    title: 'Mobile controls and driver library fixes',
    summary: 'The mobile number fields and driver views are more consistent.',
    body: [
      'Vented alignment readouts put L and Hz at the edge of the value field, without an empty stepper gap.',
      'Passive-radiator fields fit the phone layout, and driver summaries have consistent spacing.',
      'Switchable units are grey and underlined; fixed units stay white. The field audit checks units, warnings and WinISD cues.',
    ],
    href: 'https://openisd.app/',
  },
];

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
};

function allowedOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean));
}

function headersFor(request, env, contentType) {
  const headers = new Headers(NO_STORE);
  headers.set('Content-Type', contentType);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Vary', 'Origin');
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  }
  return headers;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function reviewPage(refreshUrl) {
  const cards = ANNOUNCEMENTS.map(item =>
    '<article><p class="date">' + escapeHtml(item.published) + ' | OpenISD ' + escapeHtml(item.version) + '</p>'
    + '<h2>' + escapeHtml(item.title) + '</h2><p>' + escapeHtml(item.summary) + '</p><ul>'
    + item.body.map(line => '<li>' + escapeHtml(line) + '</li>').join('')
    + '</ul></article>').join('');
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="theme-color" content="#11151c"><title>OpenISD announcements</title>'
    + '<style>:root{color-scheme:dark;font:16px/1.55 system-ui,sans-serif;background:#11151c;color:#e6edf3}'
    + 'body{margin:0;padding:24px;max-width:46rem;margin-inline:auto}header{margin:0 0 24px}h1{font-size:1.7rem;margin:0}'
    + 'p{margin:.5rem 0;color:#c3ced8}article{padding:18px 0;border-top:1px solid #39434e}h2{margin:.2rem 0;font-size:1.25rem}'
    + '.date{font-size:.9rem;color:#aab7c4}ul{padding-left:1.3rem}li{margin:.45rem 0}a{color:#8dbbff}'
    + 'footer{margin-top:28px;padding-top:18px;border-top:1px solid #39434e}</style><body>'
    + '<header><h1>OpenISD announcements</h1><p>Every announcement stays here, even after you dismiss it in the app.</p></header>'
    + (cards || '<p>No announcements yet. Check back here for news about OpenISD.</p>')
    + '<footer><a href="' + escapeHtml(refreshUrl) + '">Update OpenISD on this device</a></footer></body></html>';
}

function recoverySite(request, url) {
  const askedForTest = url.searchParams.get('site') === 'test';
  const origin = request.headers.get('Origin');
  return askedForTest || origin === 'https://test.openisd.app'
    ? 'https://test.openisd.app'
    : 'https://openisd.app';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = headersFor(request, env, 'application/json; charset=utf-8');

    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405, headers});
    }

    if (url.pathname === '/announcements' || url.pathname === '/announcements/') {
      const body = JSON.stringify({version: 1, announcements: ANNOUNCEMENTS});
      return new Response(request.method === 'HEAD' ? null : body, {headers});
    }

    if (url.pathname === '/refresh' || url.pathname === '/refresh/') {
      const site = recoverySite(request, url);
      const redirectHeaders = headersFor(request, env, 'text/plain; charset=utf-8');
      redirectHeaders.set('Location', site + '/about/refresh/');
      return new Response(null, {status: 302, headers: redirectHeaders});
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const testSite = url.searchParams.get('site') === 'test' || request.headers.get('Origin') === 'https://test.openisd.app';
      const refreshUrl = url.origin + '/refresh' + (testSite ? '?site=test' : '');
      const htmlHeaders = headersFor(request, env, 'text/html; charset=utf-8');
      return new Response(request.method === 'HEAD' ? null : reviewPage(refreshUrl), {headers: htmlHeaders});
    }

    return new Response('Not found', {status: 404, headers});
  },
};

export {ANNOUNCEMENTS, NO_STORE, reviewPage};
