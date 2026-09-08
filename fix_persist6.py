import re
with open('packages/ui/test/logic/persist.test.ts', 'r') as f:
    code = f.read()

code = code.replace("FsCell()", "Fs_hz.get()")
code = code.replace("CmsCell()", "Cms_m_per_N.get()")
code = code.replace("QtsCell()", "Qts.get()")
code = code.replace("QesCell()", "Qes.get()")
code = code.replace("QmsCell()", "Qms.get()")
code = code.replace("VasCell()", "Vas_m3.get()")
code = code.replace("SdCell()", "Sd_m2.get()")
code = code.replace("ReCell()", "Re_ohm.get()")
code = code.replace("MmsCell()", "Mms_kg.get()")
code = code.replace("BlCell()", "BL_Tm.get()")

code = code.replace("const repo = createProjectRepo(mem, new Engine(), noFilePicker);", "const repo = createProjectRepo(mem, noFilePicker);")
code = code.replace("const fileRepo = createProjectRepo(createMemoryStorage(), new Engine(), capturingPicker);", "const fileRepo = createProjectRepo(createMemoryStorage(), capturingPicker);")
code = code.replace("loaded!.project.driver", "(loaded as any)!.project.driver")
code = code.replace("projectOf('sealed', meta, drv, {})", "projectOf('sealed', meta, drv, {} as any)")

with open('packages/ui/test/logic/persist.test.ts', 'w') as f:
    f.write(code)

