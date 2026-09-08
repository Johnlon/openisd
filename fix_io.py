import re
with open('packages/ui/src/logic/useApplicationIO.ts', 'r') as f:
    c = f.read()

imports = """
import {
  OpenISDDeviceJson,
  openIsdDriverToWinIsdDriver,
  openIsdProjectToWinIsdProject,
  winIsdProjectToOpenIsdProject,
  winIsdDriverTextToOpenIsdDriver,
  WinISDProject, WinISDDriver
} from '@openisd/design/winisd';
"""
c = c.replace("import { applyLoadedProject", imports + "import { applyLoadedProject")

exportWdr = """  function exportWdr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const { value: wd, errors } = openIsdDriverToWinIsdDriver(p.driver);
    if (!wd) { flash(`Cannot export .wdr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    const bytes = new TextEncoder().encode(wd.toWdrIni());
    download(sanitizeFilename(driverName.value) + '.wdr', bytes, DriverFileFormat.Wdr.mime);
  }"""

c = re.sub(r'  function exportWdr\(\): void \{.*?(?=  function exportOwdr)', exportWdr + '\n\n', c, flags=re.DOTALL)

exportOwdr = """  function exportOwdr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const txt = OpenISDDeviceJson.toOpenisdDriverYml(p.driver.record.get());
    const bytes = new TextEncoder().encode(txt);
    download(sanitizeFilename(driverName.value) + '.owdr', bytes, DriverFileFormat.Owdr.mime);
  }"""
c = re.sub(r'  function exportOwdr\(\): void \{.*?(?=  /\*\*)', exportOwdr + '\n\n', c, flags=re.DOTALL)

exportWpr = """  function exportWpr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const { value: wp, errors } = openIsdProjectToWinIsdProject(p.driver, p.box, engine, new Date(), curvesData.value, parseLossMode(presentationState.lossMode));
    if (!wp) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    const bytes = new TextEncoder().encode(wp.toWprIni ? wp.toWprIni() : wp.toWpr());
    download(sanitizeFilename(driverName.value) + '.wpr', bytes, ProjectFileFormat.Wpr.mime);
  }"""
c = re.sub(r'  function exportWpr\(\): void \{.*?(?=  /\*\*)', exportWpr + '\n\n', c, flags=re.DOTALL)

with open('packages/ui/src/logic/useApplicationIO.ts', 'w') as f:
    f.write(c)
