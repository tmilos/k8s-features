const { Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

Then(
  'container {word} in pod {word} contains {string} in logs',
  /**
   * @this MyWorld
   * @param {string} containerName
   * @param {string} alias
   * @param {string} content
   * @returns {Promise}
   */
  async function(containerName, alias, content) {
    await this.assertLogsContain(alias, containerName, content);
  }
);

