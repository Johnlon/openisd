import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# 1. Fix createProjectRepo
code = code.replace("createProjectRepo(mem, noFilePicker, new Engine())", "createProjectRepo(new Engine(), noFilePicker)")
code = code.replace("createProjectRepo(createMemoryStorage(), capturingPicker, new Engine())", "createProjectRepo(new Engine(), capturingPicker)")

# 2. Fix .get().clear()
code = code.replace("Cms_m_per_N.get().clear()", "Cms_m_per_N.clear()")

# 3. Fix upgraded type narrowing and .driver()
old_upgraded = """const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    }));
    assert.ok(upgraded);
    assert.ok(upgraded!.driver());"""
new_upgraded = """const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: JSON.parse(sampleDriverText()),
    }));
    if (Array.isArray(upgraded)) throw new Error('fail');
    assert.ok(upgraded);
    assert.ok(upgraded!.driver);"""
code = code.replace(old_upgraded, new_upgraded)

# Wait, `upgraded!.driver()` was replaced with `upgraded!.driver` in new_upgraded. Let me check if there's any other `upgraded!.driver()`
code = code.replace("upgraded!.driver()", "upgraded!.driver")

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

