import re

with open('packages/design/domain/openisdSchema.ts', 'r') as f:
    content = f.read()

# I will add OpenISDDeviceJson namespace with fromOpenisdDriverYml and toOpenisdDriverYml
addition = """
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

// We need stripDriverYmlOnlyFields and conformingRecordToOpenIsdDeviceJson, but wait!
// These are currently in openisdTransforms.ts!
"""
