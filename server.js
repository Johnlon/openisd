import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.wdr':  'text/plain',
  '.css':  'text/css',
};

const PORT = 7788;

createServer((req, res) => {
  const url  = req.url === '/' ? '/index.html' : req.url;
  const file = join('.', url.split('?')[0]);
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`OpenISD dev server → http://localhost:${PORT}`));
