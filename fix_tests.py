import re

with open('packages/ui/test/ui/original-skin.browser.spec.ts', 'r') as f:
    content = f.read()

# Remove test 1158 and 1188 entirely as they rely on deleted sample projects feature
content = re.sub(
    r"test\('Original skin: Open the two samples.*?\}\);\n",
    "",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"test\('Original skin: Project Modified styling.*?\}\);\n",
    "",
    content,
    flags=re.DOTALL
)

with open('packages/ui/test/ui/original-skin.browser.spec.ts', 'w') as f:
    f.write(content)
