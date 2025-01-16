const { When } = require('@cucumber/cucumber');

When(
  'resource {word} does not exist',
  /**
   * @this import("../support/world.cjs").MyWorld
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
   * @this import("../support/world.cjs").MyWorld
   * @param {string} alias
   * @returns {Promise}
   */
  async function (alias) {
    await this.eventuallyResourceDoesNotExist(alias);
  }
);
