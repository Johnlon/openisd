import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {parseRepairing} from '../../domain/schemaRepair.js';

const schema = z.strictObject({
    name: z.string(),
    limit: z.number().optional(),
    vent: z.strictObject({diameter_m: z.number(), length_m: z.number()}).optional(),
    filters: z.array(z.strictObject({fc: z.number()})),
});

describe('parseRepairing', () => {
    it('removes a bad optional field and names it', () => {
        const result = parseRepairing(schema, {name: 'a', limit: 'x', filters: []});
        if (Array.isArray(result)) throw new Error(result.join('; '));
        expect(result.value).toEqual({name: 'a', filters: []});
        expect(result.repaired).toEqual([['limit']]);
    });

    it('a bad required field takes its optional parent with it', () => {
        const result = parseRepairing(schema, {name: 'a', vent: {diameter_m: 0.1, length_m: 'long'}, filters: []});
        if (Array.isArray(result)) throw new Error(result.join('; '));
        expect(result.value).toEqual({name: 'a', filters: []});
        expect(result.repaired).toEqual([['vent', 'length_m'], ['vent']]);
    });

    it('drops only the bad array element', () => {
        const result = parseRepairing(schema, {name: 'a', filters: [{fc: 1}, {fc: 'x'}, {fc: 3}]});
        if (Array.isArray(result)) throw new Error(result.join('; '));
        expect(result.value.filters).toEqual([{fc: 1}, {fc: 3}]);
        expect(result.repaired).toEqual([['filters', 1, 'fc'], ['filters', 1]]);
    });

    it('leaves the input untouched', () => {
        const input = {name: 'a', limit: 'x', filters: []};
        parseRepairing(schema, input);
        expect(input.limit).toBe('x');
    });

    it('refuses what is not this kind of record at all', () => {
        expect(Array.isArray(parseRepairing(schema, [1, 2]))).toBe(true);
        expect(Array.isArray(parseRepairing(schema, {limit: 3, filters: []}))).toBe(true); // name is required at the root
    });
});
