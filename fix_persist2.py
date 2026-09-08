import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# Fix fromOwdrJson calls
code = re.sub(r'OpenISDDriver\.fromOwdrJson\(([^)]+)\)', r'OpenISDDriver.fromConformingRecord(\1, new Engine())', code)
code = re.sub(r'OpenISDDriver\.empty\(\)', r'OpenISDDriver.fromConformingRecord({}, new Engine())', code)
code = re.sub(r'\.toOwdrJson\(\)', r'', code)

# UiParams and setBoxVolume etc. The block starting with requireFocusedProject().setActiveBoxType('vented');
# We can just comment out that block or rewrite it if there's a new API. But wait, `UiParams` tests 
# are entirely broken if `toUiParams` and `loadEmpty` don't exist anymore!
# In the new architecture, UiParams seems to be gone or moved.
# Actually, the user says "accessing .value/.state directly instead of .get().value".
code = code.replace(".get().state", ".state")
code = code.replace(".get().value", ".value")

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

