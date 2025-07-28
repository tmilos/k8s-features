const { URL } = require('node:url');
const { makeid } = require('../util/makeId.cjs');
const { MyWorld } = require('./world.cjs');
const { DataTable } = require('@cucumber/cucumber');

/*
  Then dig operation succeedes:
    | Domain         | www.example.com |
    | ExpectedOutput | something       |
*/

class DigOptions {
  domain = '';
  expectedOutput = undefined;

  /**
   * @param {import("./world.cjs").MyWorld} world
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   */
  loadFromDataTable(world, dataTable) {
    if (!(world instanceof MyWorld)) {
      throw new Error('Missing MyWorld instance');
    }
    if (!(dataTable instanceof DataTable)) {
      throw new Error('Missing DataTable instance');
    }
    for (let row of dataTable.raw()) {
      switch (row[0]) {
        case 'Domain':
          this.domain = world.templateWithThrow(row[1]);
          break;
        case 'ExpectedOutput':
          this.expectedOutput = world.templateWithThrow(row[1]);
          break;
        default:
          throw new Error(`Unknown dig option ${row[0]}`);
      }
    }
  }

  /**
   * @returns string[]
   */
  getArgs() {
    if (!this.domain) {
      throw new Error(`Invalid domain: ${this.domain}`);
    }

    const args = [this.domain];

    return args;
  }

  /**
   * @param {string|undefined} namespace
   * @returns {string}
   */
  getPodManifest(namespace) {
    const args = this.getArgs();
    const name = `k8fdig${makeid(8)}`;
    namespace = namespace ?? 'default';

    const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  containers:
    - name: dig
      image: toolbelt/dig
      args:
${args.map(x => `        - '${x}'`).join('\n')}
      imagePullPolicy: IfNotPresent
  restartPolicy: Never
    `;
    return manifest;
  }
}

module.exports = {
  DigOptions,
};
