import {describe, expect, it} from 'vitest';
import {openISDProjectJsonSchema} from '../../domain/openisdSchema.js';

describe('openISDEnvironmentJsonSchema — legacy migration preprocess', () => {
  it('passes a non-record environment value through unchanged, so the object schema reports the real parse error', () => {
    const envSchema = openISDProjectJsonSchema.shape.environment;
    expect(() => envSchema.parse('not-a-record')).toThrow();
  });
});
