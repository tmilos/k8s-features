const { Then } = require('@cucumber/cucumber');

Then(
  'apiVersion {word} exists',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async function(apiVersion) {
    await this.apiVersionExists(apiVersion);
  }
);
