import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const engine = require('../src/core/index.js');
