const { DataTable, Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');
const { HttpOptions } = require('../support/http.cjs');

Then(
  'HTTP GET to {string} succeedes',
  /**
   * @this MyWorld
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
    | Url         | https://example.com |
    | Method      | POST                |
    | ContentType | application/json    |
    | Data        | {"foo": "bar"}      |
*/
Then(
  'HTTP operation succeedes:',
  /**
   * @this MyWorld
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   */
  async function(dataTable) {
    const options = new HttpOptions();
    options.loadFromDataTable(dataTable);
    await this.http(options);
  }
);
