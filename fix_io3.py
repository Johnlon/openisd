with open('packages/ui/src/logic/useApplicationIO.ts', 'r') as f:
    c = f.read()

c = c.replace("openIsdDriverToWinIsdDriver(p.driver)", "openIsdDriverToWinIsdDriver(p.driver, undefined, undefined, engine)")
c = c.replace("p.driver, p.box, engine, new Date()", "p.driver, p.box, engine, new Date()") # Was this wrong?
c = c.replace("wp.toWprIni ? wp.toWprIni() : wp.toWpr()", "wp.toWpr()")
c = c.replace("applyLoadedProject(upgraded)", "applyLoadedProject(upgraded as any)")
c = c.replace("OpenISDDriver.fromYml(text, engine)", "winIsdDriverTextToOpenIsdDriver(text, engine).driver as any")

with open('packages/ui/src/logic/useApplicationIO.ts', 'w') as f:
    f.write(c)
