const { Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

Then(
  'apiVersion {word} does not exist',
  /**
   * @this MyWorld
   * @param {string} apiVersion 
   * @returns {Promise}
   */
  async function(apiVersion) {
    await this.apiVersionDoesNotExist(apiVersion);
  }
);
