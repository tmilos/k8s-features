const { Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

Then(
  'apiVersion {word} exists',
  /**
   * @this MyWorld
   * @param {string} apiVersion 
   * @returns {Promise}
   */
  async function(apiVersion) {
    await this.apiVersionExists(apiVersion);
  }
);
