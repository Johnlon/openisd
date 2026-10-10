import fs from 'fs';
let content = fs.readFileSync('packages/ui/test/ui/projects-across-addresses.browser.spec.ts', 'utf8');

// Fix test 2: fileChooser
content = content.replace(/const fileChooserPromise = page\.waitForEvent\('filechooser'\);\n\s*await page\.locator\('\.open-from-disk'\)\.click\(\);\n\s*const fileChooser = await fileChooserPromise;\n\s*await fileChooser\.setFiles\(path!\);/, `await page.locator('.original-root input[type=file]').setInputFiles(path!);`);

// Fix test 3: Save button selector
content = content.replace(/await page\.locator\('\.tb-btn\\[title\\^="Save project"\\]'\)\.click\(\);/g, `await page.locator('.tb-btn[title^="Save"]').first().click();`);

fs.writeFileSync('packages/ui/test/ui/projects-across-addresses.browser.spec.ts', content);
