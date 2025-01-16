const { Then } = require('@cucumber/cucumber');
const { HttpOptions } = require('../support/http.cjs');

Then(
  'HTTP GET to {string} succeedes',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} url
   */
  async function(url) {
    const options = new HttpOptions();
    options.url = url;
    await this.http(options);
  }
);

/*
  Then HTTP operation succeedes:
    | Url            | https://example.com |
    | Method         | POST                |
    | ContentType    | application/json    |
    | Data           | {"foo": "bar"}      |
    | MaxTime        | 10                  |
    | ExpectedOutput | something           |
*/

Then(
  'HTTP operation succeedes:',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   */
  async function(dataTable) {
    const options = new HttpOptions();
    options.loadFromDataTable(this, dataTable);
    await this.http(options);
  }
);
