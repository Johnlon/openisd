import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# 1. Fix createProjectRepo
code = code.replace("createProjectRepo(mem, noFilePicker)", "createProjectRepo(new Engine(), noFilePicker)")
code = code.replace("createProjectRepo(createMemoryStorage(), capturingPicker)", "createProjectRepo(new Engine(), capturingPicker)")

# 2. Revert Fs_hz.get() back to spec[section].Fs_hz.get()
code = code.replace("src.Fs_hz.get()", "src.spec[src.section].Fs_hz.get()")
code = code.replace("src.Cms_m_per_N.get()", "src.spec[src.section].Cms_m_per_N.get()")

# Fix in stateOf
code = code.replace("return d.Fs_hz.get().state", "return d.spec[d.section].Fs_hz.get().state")
code = code.replace("return d.Qts.get().state", "return d.spec[d.section].Qts.get().state")
code = code.replace("return d.Qes.get().state", "return d.spec[d.section].Qes.get().state")
code = code.replace("return d.Qms.get().state", "return d.spec[d.section].Qms.get().state")
code = code.replace("return d.Vas_m3.get().state", "return d.spec[d.section].Vas_m3.get().state")
code = code.replace("return d.Sd_m2.get().state", "return d.spec[d.section].Sd_m2.get().state")
code = code.replace("return d.Re_ohm.get().state", "return d.spec[d.section].Re_ohm.get().state")
code = code.replace("return d.Cms_m_per_N.get().state", "return d.spec[d.section].Cms_m_per_N.get().state")
code = code.replace("return d.Mms_kg.get().state", "return d.spec[d.section].Mms_kg.get().state")
code = code.replace("return d.BL_Tm.get().state", "return d.spec[d.section].BL_Tm.get().state")

# 3. Fix withBand
# Line 218 is in "it('every ui field travels')" 
# "decodeShare((await repo.stateToUrl(project, withBand)) as string);" -> it should be uiView
code = code.replace("repo.stateToUrl(project, withBand)", "repo.stateToUrl(project, uiView)")
# BUT wait! This also replaces it inside `it('the dragged band crosses...')` which actually needs `withBand`!
# So I should change the one in `withBand` back!
# Wait, let me just fix the error `Cannot find name 'project'. Did you mean 'projectOf'?` and `withBand` in that file.
# The code was:
# ```
# const decoded = decodeShare((await repo.stateToUrl(project, withBand)) as string);
# if (Array.isArray(decoded)) throw new Error('fail');
# const shared = decoded(await repo.stateToUrl(projectOf('sealed', meta, drv, {} as any), uiView));
# ```
# Wow, my previous regex mangled this horribly. Let's fix it by regexing this block.
mangled_block = """const decoded = decodeShare((await repo.stateToUrl(project, uiView)) as string);
    if (Array.isArray(decoded)) throw new Error('fail');
    const shared = decoded(await repo.stateToUrl(projectOf('sealed', meta, drv, {} as any), uiView));"""

fixed_block = """const urlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv, {} as any), uiView);
    if (Array.isArray(urlOrErr)) throw new Error('fail');
    const shared = decodeShare(urlOrErr as string);"""
code = code.replace(mangled_block, fixed_block)

mangled_block2 = """const decoded = decodeShare((await repo.stateToUrl(project, withBand)) as string);
    if (Array.isArray(decoded)) throw new Error('fail');
    const shared = decoded(await repo.stateToUrl(projectOf('sealed', meta, drv, {} as any), uiView));"""
code = code.replace(mangled_block2, fixed_block)

# 4. In `it('carries the graph cursor...')`
# The mangled block was: `decodeShare((await repo.stateToUrl(project, withBand)) as string).cursor` 
# It should be `withCursor`
code = code.replace("assert.deepEqual(decodeShare((await repo.stateToUrl(project, uiView)) as string).cursor,", 
  "assert.deepEqual(decodeShare((await repo.stateToUrl(project, withCursor)) as string).cursor,")
code = code.replace("assert.deepEqual(decodeShare((await repo.stateToUrl(project, withBand)) as string).cursor,", 
  "assert.deepEqual(decodeShare((await repo.stateToUrl(project, withCursor)) as string).cursor,")
# Actually, let's fix `withBand` properly. The next test uses `withBand`. 
# We'll replace ALL `(project, uiView)` back and manually fix.
# Better yet, I'll use regex to target the specific asserts.
code = re.sub(r"assert\.deepEqual\(decodeShare\(\(await repo\.stateToUrl\(project, [^)]+\)\) as string\)\.cursor,\n\s*\{ f: 123\.4",
  "assert.deepEqual(decodeShare((await repo.stateToUrl(project, withCursor)) as string).cursor,\n      { f: 123.4", code)

code = re.sub(r"assert\.deepEqual\(decodeShare\(\(await repo\.stateToUrl\(project, [^)]+\)\) as string\)\.cursor\.range,\n\s*\{ fLo: 31\.6",
  "assert.deepEqual(decodeShare((await repo.stateToUrl(project, withBand)) as string).cursor.range, { fLo: 31.6", code)

# 5. Type narrowing for loaded
type_narrow_loaded = """const loaded = await repo.loadFromHash();
    if (Array.isArray(loaded)) throw new Error('fail');"""
code = code.replace("const loaded = await repo.loadFromHash();", type_narrow_loaded)
# And `repo.readProjectText`
type_narrow_upgraded = """const upgraded = repo.readProjectText(JSON.stringify({"""
replacement_upgraded = """const upgraded = repo.readProjectText(JSON.stringify({"""
code = code.replace(type_narrow_upgraded, replacement_upgraded) # Wait, need to cast it?
# Let's just narrow it:
code = code.replace("assert.ok(upgraded!);", "if (Array.isArray(upgraded)) throw new Error();\n    assert.ok(upgraded!);")


with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

