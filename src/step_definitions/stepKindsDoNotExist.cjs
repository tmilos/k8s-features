const { Then } = require('@cucumber/cucumber');

Then(
  'kinds in apiVersion {word} do not exist:',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} apiVersion
   * @param {import("@cucumber/cucumber").DataTable} dataTable
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
