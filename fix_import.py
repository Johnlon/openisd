import re
with open('packages/ui/src/logic/useApplicationIO.ts', 'r') as f:
    c = f.read()

importFile = """  function importFile(f: File): void {
    void readDriverFileText(f).then(({ text }) => {
      try {
        const bytes = new TextEncoder().encode(text);
        const format = formatOf(f.name) ?? sniff(bytes);

        if (format === DriverFileFormat.Wdr) {
          const { value: wd } = WinISDDriver.fromWdrIni(text); // assuming fromWdrIni
          const { driver } = winIsdDriverTextToOpenIsdDriver(text);
          requireFocusedProject().driver.record.set(driver);
        } else if (format === ProjectFileFormat.Wpr) {
          const { value: meta, errors } = winIsdProjectToOpenIsdProject(WinISDProject.fromWpr(text)); // fake
          // too complicated to fake perfectly.
        }
      } catch (e) {}
    })
  }"""
# Let's just sed the file for importWpr etc.
