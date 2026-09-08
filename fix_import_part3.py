with open('packages/ui/src/logic/useApplicationIO.ts', 'r') as f:
    c = f.read()

# Find the indices
start_idx = c.find('  function importFile(f: File): void {')
end_idx = c.find('  function about(): void {')

importFile = """  function importFile(f: File): void {
    void readDriverFileText(f).then(({ text }) => {
      try {
        const bytes = new TextEncoder().encode(text);
        const format = formatOf(f.name) ?? sniff(bytes);

        if (format === DriverFileFormat.Wdr) {
          const { driver, errors } = winIsdDriverTextToOpenIsdDriver(text, engine);
          if (!driver) throw new Error(errors[0]?.message ?? 'could not read .wdr');
          requireFocusedProject().driver.record.set(driver);
        } else if (format === ProjectFileFormat.Wpr) {
          const { value: loadedProj, errors } = winIsdProjectToOpenIsdProject(text, engine);
          if (!loadedProj) throw new Error(errors[0]?.message ?? 'could not read .wpr');
          applyLoadedProject(loadedProj);
          state.project.name = projectNameFromFilename(f.name);
        } else if (format === DriverFileFormat.Owdr) {
          requireFocusedProject().driver.record.set(JSON.parse(text));
        } else if (format === ProjectFileFormat.Owpr || /^\s*\{/.test(text)) {
          if (sniff(bytes) === DriverFileFormat.Owdr) {
            requireFocusedProject().driver.record.set(JSON.parse(text));
          } else {
            const upgraded = deps.projectRepo.readProjectText(text);
            if (!upgraded) throw new Error('the file could not be brought to the current schema');
            applyLoadedProject(upgraded);
            state.project.name = projectNameFromFilename(f.name);
          }
        } else {
          throw new Error('Unsupported or unrecognized file format');
        }
        deps.fileStorage.forget();
        flash('Opened ' + f.name);
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err instanceof Error ? err.message : String(err))); }
    }, (err: Error) => { alert('Could not read "' + f.name + '": ' + err.message); });
  }

"""

if start_idx != -1 and end_idx != -1:
    c = c[:start_idx] + importFile + c[end_idx:]
    with open('packages/ui/src/logic/useApplicationIO.ts', 'w') as f:
        f.write(c)
    print("Success")
else:
    print("Failed to find boundaries")
