import re

with open('packages/design/domain/openisdSchema.ts', 'r') as f:
    content = f.read()

content = content.replace(
    """export const openISDProjectSessionJsonSchema = z.strictObject({
    saved: openISDProjectJsonSchema,
    edited: openISDProjectJsonSchema.nullable(),
});""",
    """export const openISDProjectSessionJsonSchema = z.strictObject({
    label: z.string(),
    saved: openISDProjectJsonSchema,
    edited: openISDProjectJsonSchema.nullable(),
});"""
)

with open('packages/design/domain/openisdSchema.ts', 'w') as f:
    f.write(content)
