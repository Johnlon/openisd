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

    it('drops a key this build does not know without naming it', () => {
        const result = parseRepairing(schema, {name: 'a', laterKey: 1, vent: {diameter_m: 0.1, length_m: 0.2, flare: true}, filters: []});
        if (Array.isArray(result)) throw new Error(result.join('; '));
        expect(result.value).toEqual({name: 'a', vent: {diameter_m: 0.1, length_m: 0.2}, filters: []});
        expect(result.repaired).toEqual([]);
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

    it('an issue at a path holding a symbol is not repairable and is refused with the symbol named', () => {
        const symbolic = z.strictObject({name: z.string()}).superRefine((_value, ctx) => {
            ctx.addIssue({code: 'custom', message: 'odd', path: [Symbol('k')]});
        });
        expect(parseRepairing(symbolic, {name: 'a'})).toEqual(["'Symbol(k)': odd"]);
    });

    it('refuses when the issue path runs through a value that has no such child', () => {
        const deep = z.strictObject({name: z.string()}).superRefine((_value, ctx) => {
            ctx.addIssue({code: 'custom', message: 'deep', path: ['name', 'x', 'y']});
        });
        expect(parseRepairing(deep, {name: 'a'})).toEqual(["'name.x.y': deep"]);
    });

    it('refuses when nothing named by the issues can be removed', () => {
        const ghost = z.strictObject({name: z.string()}).superRefine((_value, ctx) => {
            ctx.addIssue({code: 'unrecognized_keys', keys: ['ghost'], path: [], message: 'ghost key'});
        });
        expect(parseRepairing(ghost, {name: 'a'})).toEqual(['ghost key']);
    });
});
