with open('packages/ui/src/logic/useApplicationIO.ts', 'r') as f:
    c = f.read()

# Prepend imports
imports = """import { OpenISDDeviceJson } from '@openisd/design/domain';
import { openIsdDriverToWinIsdDriver, openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject, winIsdDriverTextToOpenIsdDriver, WinISDProject, WinISDDriver } from '@openisd/design/winisd';
import { engine } from './appState.js';
"""
c = imports + c

# Fix record access
c = c.replace("requireFocusedProject().driver.record.set(driver);", "requireFocusedProject().setDriver(driver);")

# For JSON parsing
c = c.replace("requireFocusedProject().driver.record.set(JSON.parse(text));", 
              "requireFocusedProject().setDriver(OpenISDDriver.fromYml(text, engine));") # Wait, OpenISDDriver from JSON? No, fromConformingRecord? I'll use fromYml just as a stand-in or fromConformingRecord(JSON.parse(text), engine).

c = c.replace("requireFocusedProject().driver.record.set(JSON.parse(text));", 
              "requireFocusedProject().setDriver(OpenISDDriver.fromConformingRecord(JSON.parse(text), engine) as any);")

c = c.replace("OpenISDDeviceJson.toOpenisdDriverYml(p.driver.record.get());", 
              "OpenISDDeviceJson.toOpenisdDriverYml(p.driver.toOpenIsdDeviceJson());")

with open('packages/ui/src/logic/useApplicationIO.ts', 'w') as f:
    f.write(c)
