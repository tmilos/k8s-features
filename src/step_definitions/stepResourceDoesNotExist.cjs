const { When } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

When(
  'resource {word} does not exist', 
  /**
   * @this MyWorld
   * @param {string} alias
   * @returns {Promise}
   */
  async function (alias) {
    this.resourceDoesNotExist(alias);
  }
);

When(
  'eventually resource {word} does not exist', 
  /**
   * @this MyWorld
   * @param {string} alias
   * @returns {Promise}
   */
  async function (alias) {
    await this.eventuallyResourceDoesNotExist(alias);
  }
);
