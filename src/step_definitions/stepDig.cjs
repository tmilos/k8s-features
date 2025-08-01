const { Then } = require('@cucumber/cucumber');
const { DigOptions } = require('../support/dig.cjs');

Then(
  'dig {string} resolves to {string}',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} domain
   * @param {string} ip
   */
  async function(domain, ip) {
    const options = new DigOptions();
    options.domain = domain;
    options.expectedOutput = ip
    await this.dig(options);
  }
);

/*
  Then dig operation succeedes:
    | Domain         | example.com |
    | ExpectedOutput | something   |
*/

Then(
  'dig operation succeedes:',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   */
  async function(dataTable) {
    const options = new DigOptions();
    options.loadFromDataTable(this, dataTable);
    await this.dig(options);
  }
);
