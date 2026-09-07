import re

with open('packages/design/domain/openisdSchema.ts', 'r') as f:
    content = f.read()

addition = """
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { driverSectionProblems, radiatorSectionProblems } from './openisdTransforms.js';

export const OpenISDDeviceJson = {
    fromOpenisdDriverYml(ymlText: string): { json: OpenISDDeviceJson } | { problems: string[] } {
        let parsed: unknown;
        try {
            parsed = parseYaml(ymlText);
        } catch (e) {
            return {problems: [`not valid YAML: ${e instanceof Error ? e.message : String(e)}`]};
        }
        return OpenISDDeviceJson.fromConformingRecord(OpenISDDeviceJson.stripDriverYmlOnlyFields(parsed));
    },

    toOpenisdDriverYml(json: OpenISDDeviceJson): string {
        return stringifyYaml(json);
    },

    fromConformingRecord(record: unknown): { json: OpenISDDeviceJson } | { problems: string[] } {
        const result = openISDDeviceJsonSchema.safeParse(record);
        if (result.success) return {json: result.data};
        return {
            problems: result.error.issues.map(issue => issue.path.length === 0
                ? issue.message
                : `'${issue.path.join('.')}: ${issue.message}`),
        };
    },

    stripDriverYmlOnlyFields(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(OpenISDDeviceJson.stripDriverYmlOnlyFields);
        if (typeof value !== 'object' || value === null) return value;

        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(value)) {
            if (key === 'definition' || key === 'scraper' || key === 'scraper_meta') continue;
            out[key] = OpenISDDeviceJson.stripDriverYmlOnlyFields(v);
        }
        return out;
    }
};
"""

content = content + "\n" + addition

with open('packages/design/domain/openisdSchema.ts', 'w') as f:
    f.write(content)
