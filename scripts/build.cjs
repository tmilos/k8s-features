const { cpSync, rmSync, mkdirSync } = require('node:fs');
const { globSync } = require('glob');

rmSync('./dist', { recursive: true, force: true});
mkdirSync('./dist/src', {recursive: true});

cpSync('./src', './dist/src', {recursive: true});

rmSync('./dist/src/tests', { recursive: true, force: true});
rmSync('./dist/src/features', { recursive: true, force: true});

for (let fn of globSync("./dist/**/*.spec.{cjs,mjs,js,ts}")) {
  rmSync(fn);
}
