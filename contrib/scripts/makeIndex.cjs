const { readdirSync, writeFileSync } = require('fs');

function makeIndex(dir) {
  console.log(dir);
  let files = readdirSync(dir);
  files = files.filter(f => f !== 'index.cjs' && f !== 'index.mjs');

  const cjsContent = files.map(f => `require('./${f}');`).join("\n")+"\n";

  const mjsContent = `export * from './index.cjs';` + "\n";

  writeFileSync(`${dir}/index.cjs`, cjsContent);
  console.log('    index.cjs');
  writeFileSync(`${dir}/index.mjs`, mjsContent);
  console.log('    index.mjs');
}

const args = process.argv.slice(2);
if (!args || args.length < 1) {
  throw new Error('Expected one or more dir argument(s) where to build the index files');
}

for (let dir of args) {
  makeIndex(dir);
}
