// Lets `node --test scripts/content/` run this folder's tests: Node 22+ treats a directory argument as a module to
// run, not as a folder to search, and lands here. Loads every *.test.mjs next to this file.
// (`cd scripts && npm test` and `node --test "scripts/content/**/*.test.mjs"` run the same tests.)
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  for (const file of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.mjs')).sort()) {
    await import(pathToFileURL(path.join(__dirname, file)).href);
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
