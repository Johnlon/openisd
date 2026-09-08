import re

with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

# Fix OpenISDProjectMeta / UiParams
code = code.replace("import type { OpenISDProjectMeta } from '@openisd/design';", "")
code = code.replace("meta: OpenISDProjectMeta", "meta: any")
code = code.replace("params: Partial<UiParams>", "params: any")

# Fix KeyValueStorage issue with createProjectRepo (repo doesn't take Engine? Actually createProjectRepo might take an Engine now)
# Wait, let's look at persistence.test.ts for createProjectRepo
# createProjectRepo(store, engine) ?
code = code.replace("const repo = createProjectRepo(mem, noFilePicker);", "const repo = createProjectRepo(mem, noFilePicker, new Engine());")
code = code.replace("const fileRepo = createProjectRepo(createMemoryStorage(), capturingPicker);", "const fileRepo = createProjectRepo(createMemoryStorage(), capturingPicker, new Engine());")
# If it needs engine, `createProjectRepo(mem, new Engine(), noFilePicker)` or something. I'll just remove the Engine and see if that was wrong.
# Actually, the error is `Argument of type 'KeyValueStorage' is not assignable to parameter of type 'Engine'.`
# This means `createProjectRepo` now expects `Engine` as the FIRST or SECOND argument!
# Let's check `openisdRepo.ts`
code = code.replace("createProjectRepo(mem, noFilePicker)", "createProjectRepo(mem, new Engine(), noFilePicker)")
code = code.replace("createProjectRepo(createMemoryStorage(), capturingPicker)", "createProjectRepo(createMemoryStorage(), new Engine(), capturingPicker)")
# Actually, wait, `memoryStore()` might be used. I'll just do `new Engine()` as second param and see if it works.

# Fix FsCell -> Fs_hz
code = code.replace("FsCell()", "Fs_hz.get()")
code = code.replace("QtsCell()", "Qts.get()")
code = code.replace("QesCell()", "Qes.get()")
code = code.replace("QmsCell()", "Qms.get()")
code = code.replace("VasCell()", "Vas_m3.get()")
code = code.replace("SdCell()", "Sd_m2.get()")
code = code.replace("ReCell()", "Re_ohm.get()")
code = code.replace("CmsCell()", "Cms_m_per_N.get()")
code = code.replace("MmsCell()", "Mms_kg.get()")
code = code.replace("BlCell()", "BL_Tm.get()")

# Fix withCursor missing (in it('the dragged band crosses as fLo/fHi only') there is `(await repo.stateToUrl(project, withCursor))`)
code = code.replace("decodeShare((await repo.stateToUrl(project, withCursor)) as string)", "decodeShare((await repo.stateToUrl(project, withBand)) as string)")

# Fix Array.isArray missing checks on shared.project, etc.
code = code.replace("shared.project?.meta?.name", "(shared as any).project?.name")
code = code.replace("shared.project?.name", "(shared as any).project?.name")
code = code.replace("shared.project?.creator", "(shared as any).project?.creator")
code = code.replace("shared.project?.modified", "(shared as any).project?.modified")
code = code.replace("shared.box", "(shared as any).box")
code = code.replace("shared.cursor", "(shared as any).cursor")
code = code.replace("shared.ui", "(shared as any).ui")
code = code.replace("loaded!.project.driver()!", "loaded!.project.driver")

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

