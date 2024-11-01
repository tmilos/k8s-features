const { cpSync, rmSync, mkdirSync } = require('node:fs');
const { globSync } = require('glob');

rmSync('./dist', { recursive: true, force: true});
mkdirSync('./dist/src', {recursive: true});

cpSync('./LICENSE', './dist/LICENSE');
cpSync('./README.md', './dist/README.md');

cpSync('./steps.cjs', './dist/steps.cjs');
cpSync('./steps.mjs', './dist/steps.mjs');
cpSync('./lib.cjs', './dist/lib.cjs');
cpSync('./lib.mjs', './dist/lib.mjs');
cpSync('./src', './dist/src', {recursive: true});

rmSync('./dist/src/tests', { recursive: true, force: true});
rmSync('./dist/src/features', { recursive: true, force: true});

for (let fn of globSync("./dist/**/*.spec.{cjs,mjs,js,ts}")) {
  rmSync(fn);
}
