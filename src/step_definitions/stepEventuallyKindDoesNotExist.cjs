const { Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

Then(
  'eventually kind {word} of {word} does not exist',
  /**
   * @this MyWorld
   * @param {string} kind
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async function(kind, apiVersion) {
    await this.eventuallyKindDoesNotExist(kind, apiVersion);
  },
);
