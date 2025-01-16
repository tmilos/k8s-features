const { Then } = require('@cucumber/cucumber');

Then(
  'apiVersion {word} does not exist',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async function(apiVersion) {
    await this.apiVersionDoesNotExist(apiVersion);
  }
);
