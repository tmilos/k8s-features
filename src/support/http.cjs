const { URL } = require('node:url');
const { makeid } = require('../util/makeId.cjs');

/*
  Then HTTP operation succeedes:
    | Url            | https://example.com |
    | Method         | POST                |
    | ContentType    | application/json    |
    | Data           | {"foo": "bar"}      |
    | MaxTime        | 10                  |
    | ExpectedOutput | something           |
*/

class HttpOptions {
  url = '';
  method = undefined;
  contentType = undefined;
  data = undefined;
  maxTime = 10;
  expectedOutput = undefined;

  /**
   * @param {import("./world.cjs").MyWorld} world
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   */
  loadFromDataTable(world, dataTable) {
    if (!dataTable) {
      return;
    }
    for (let row of dataTable.raw()) {
      switch (row[0]) {
        case 'Url':
          this.url = world.templateWithThrow(row[1]);
        case 'Method':
          this.method = world.templateWithThrow(row[1]);
        case 'ContentType':
          this.contentType = world.templateWithThrow(row[1]);
        case 'Data':
          this.data = world.templateWithThrow(row[1]);
        case 'MaxTime':
          this.maxTime = world.templateWithThrow(row[1]);
        case 'ExpectedOutput':
          this.expectedOutput = world.templateWithThrow(row[1]);
        default:
          throw new Error(`Unknown HTTP option ${row[0]}`);
      }
    }
  }

  /**
   * @returns string[]
   */
  getArgs() {
    if (!this.url || !URL.canParse(this.url)) {
      throw new Error(`Invalid url: ${this.url}`);
    }

    const args = [
      '-L',
      '-m',
      this.maxTime ?? '10',
    ];
    if (this.method) {
      args.push('-X', this.method);
    }
    if (this.contentType) {
      args.push('-H', `Content-Type: ${this.contentType}`);
    }
    if (this.data) {
      args.push('-d', this.data);
    }
    args.push(this.url);
    return args;
  }

  /**
   * @param {string|undefined} namespace
   * @returns {string}
   */
  getPodManifest(namespace) {
    const args = this.getArgs();
    const name = `k8fhttp${makeid(8)}`;
    namespace = namespace ?? 'default';

    const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  containers:
    - name: curl
      image: curlimages/curl
      args:
${args.map(x => `        - '${x}'`).join('\n')}
      imagePullPolicy: IfNotPresent
  restartPolicy: Never
    `;
    return manifest;
  }
}

module.exports = {
  HttpOptions,
};
