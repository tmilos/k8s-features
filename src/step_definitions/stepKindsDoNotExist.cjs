const { DataTable, Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

Then(
  'kinds in apiVersion {word} do not exist:',
  /**
   * @this MyWorld
   * @param {string} apiVersion 
   * @param {DataTable} dataTable
   * @returns {Promise}
   */
  async function (apiVersion, dataTable) {
    const kinds = dataTable ? dataTable.raw().map(r => r[0]) : [];
    if (kinds.length < 1) {
      throw new Error('At least one kind must be specified');
    }
    await this.kindsDoNotExist(apiVersion, ...kinds);
  },
);
