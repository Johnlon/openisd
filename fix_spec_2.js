import fs from 'fs';
let content = fs.readFileSync('packages/ui/test/ui/projects-across-addresses.browser.spec.ts', 'utf8');

// Remove the redundant click on Open project
content = content.replace(/await page\.locator\('\.tb-btn\\[title\^="Open project"\\]'\)\.click\(\);\n\s*const projectRows = page\.locator\('\.stored-project-row'\);/, 'const projectRows = page.locator(\'.stored-project-row\');');

// Fix Save project selector
content = content.replace(/await page\.locator\('\.tb-btn\[title\^="Save project"\]'\)\.click\(\);/, 'await page.locator(\'.tb-btn[title^="Save"]\').first().click();');

fs.writeFileSync('packages/ui/test/ui/projects-across-addresses.browser.spec.ts', content);
