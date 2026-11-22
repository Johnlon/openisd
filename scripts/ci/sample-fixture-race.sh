#!/usr/bin/env bash
# Four generators at once on a missing sample file, and a reader that parses it as often as it can.
cd "$1"; rm -rf build/test-fixtures
G=packages/ui/test/fixtures/generateSample.ts
pids=(); for i in 1 2 3 4; do npx vite-node $G > /dev/null 2>&1 & pids+=($!); done
bad=0; good=0
node -e '
const fs=require("fs"); const f="build/test-fixtures/sample-project.owpr"; let bad=0, good=0; const end=Date.now()+15000;
while (Date.now()<end) { try { JSON.parse(fs.readFileSync(f,"utf8")); good++; } catch (e) { if (e.code!=="ENOENT") bad++; } }
console.log(`reads ok ${good}, reads not valid JSON ${bad}`);'
wait "${pids[@]}"
