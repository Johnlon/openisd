import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# Fix import
code = re.sub(r"import \{ winISDDriverToOpenISDDeviceJson \} from '@openisd/design/domain/openisdSchema';\n", "", code)
code = re.sub(r"import type \{ UiParams, OpenISDProjectMeta \} from '@openisd/design';", "import type { OpenISDProjectMeta } from '@openisd/design';", code)

# fix sampleDriverText to just read the raw JSON
# Wait, the sample driver is an openisd device JSON.
# I will just write a very minimal sample driver JSON
new_sample = """function sampleDriverText(): any {
  return {
    brand: {value: 'test'}, model: {value: 'test'}, manufacturer: {value: 'test'}, 
    uuid: {value: '00000000-0000-4000-8000-000000000000'}, driver_type: {value: 'woofer'}, 
    specs: { woofer: { Fs: { origin: 'entered', readings: { manual: { read_value: 30 } } } } }
  };
}"""
code = re.sub(r'function sampleDriverText\(\): any \{.*?\n\}', new_sample, code, flags=re.DOTALL)

# Fix src array check
code = code.replace("const src = OpenISDDriver.fromConformingRecord(sampleDriverText(), new Engine());", 
  "const srcOrErr = OpenISDDriver.fromConformingRecord(sampleDriverText(), new Engine());\n    const src = Array.isArray(srcOrErr) ? null : srcOrErr;\n    if (!src) throw new Error('Bad driver');")
code = code.replace("const back = OpenISDDriver.fromConformingRecord(wire.driver, new Engine());", 
  "const backOrErr = OpenISDDriver.fromConformingRecord(wire.driver, new Engine());\n    const back = Array.isArray(backOrErr) ? null : backOrErr;\n    if (!back) throw new Error('Bad back driver');")

# Fix `.spec` -> wait, does OpenISDDriver still have `spec`?
# In `openisdDomain.ts`, the getters are on the class or there's `.FsCell()` etc.
code = code.replace("src.spec[src.section].Fs_hz", "src.FsCell()")
code = code.replace("src.spec[src.section].Cms_m_per_N", "src.CmsCell()")
code = code.replace("back.spec[back.section].Fs_hz", "back.FsCell()")
code = code.replace("back.spec[back.section].Cms_m_per_N", "back.CmsCell()")

# Wait, `stateOf` function:
stateOf_old = """function stateOf(d: OpenISDDriver, field: typeof CHECKED_FIELDS[number]) {
      switch (field) {
        case 'Fs': return d.spec[d.section].Fs_hz.state;
        case 'Qts': return d.spec[d.section].Qts.state;
        case 'Qes': return d.spec[d.section].Qes.state;
        case 'Qms': return d.spec[d.section].Qms.state;
        case 'Vas': return d.spec[d.section].Vas_m3.state;
        case 'Sd': return d.spec[d.section].Sd_m2.state;
        case 'Re': return d.spec[d.section].Re_ohm.state;
        case 'Cms': return d.spec[d.section].Cms_m_per_N.state;
        case 'Mms': return d.spec[d.section].Mms_kg.state;
        case 'BL': return d.spec[d.section].BL_Tm.state;
      }
    }"""
stateOf_new = """function stateOf(d: any, field: typeof CHECKED_FIELDS[number]) {
      switch (field) {
        case 'Fs': return d.FsCell().state;
        case 'Qts': return d.QtsCell().state;
        case 'Qes': return d.QesCell().state;
        case 'Qms': return d.QmsCell().state;
        case 'Vas': return d.VasCell().state;
        case 'Sd': return d.SdCell().state;
        case 'Re': return d.ReCell().state;
        case 'Cms': return d.CmsCell().state;
        case 'Mms': return d.MmsCell().state;
        case 'BL': return d.BlCell().state;
      }
    }"""
code = code.replace(stateOf_old, stateOf_new)

# Fix uiView cursor
uiView_old = """const uiView: ViewSnapshot = {
    graphs: ['SPL'],
    ui: {"""
uiView_new = """const uiView: ViewSnapshot = {
    graphs: ['SPL'],
    cursor: { f: null, pinnedF: null, locked: false, range: null },
    ui: {"""
code = code.replace(uiView_old, uiView_new)

# Fix project / decodeShare errors
code = code.replace("shared.project?.name", "shared.project?.meta?.name") # Assuming structure change? Or just "shared.project" errors?
# Actually the error says `project` does not exist on type `string[] | { project: OpenISDProject; view: ViewSnapshot; }`.
# So `decodeShare` or whatever is returning `{project: ..., view: ...}` or `string[]`. 
code = code.replace("const shared = decodeShare", "const decoded = decodeShare(await repo.stateToUrl(project, uiView));\n    if (Array.isArray(decoded)) throw new Error('fail');\n    const shared = decoded")
# The test says: const shared = decodeShare(await repo.stateToUrl(projectOf('sealed', meta, drv, {}), uiView));
code = re.sub(r'const shared = decodeShare\(await repo\.stateToUrl\([^)]+\), uiView\)\);', 
  r'''const urlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv, {}), uiView);
    if (Array.isArray(urlOrErr)) throw new Error('fail');
    const shared = decodeShare(urlOrErr);''', code)

# Same for other stateToUrl calls
code = re.sub(r'const shareUrl = await repo\.stateToUrl\([^)]+\), uiView\);',
  r'''const shareUrlOrErr = await repo.stateToUrl(projectOf('sealed', meta, drv, {}), uiView);
    if (Array.isArray(shareUrlOrErr)) throw new Error('fail');
    const shareUrl = shareUrlOrErr;''', code)

code = re.sub(r'decodeShare\(await repo\.stateToUrl\(project, [^)]+\)\)',
  r'decodeShare((await repo.stateToUrl(project, withCursor)) as string)', code)

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

