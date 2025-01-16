const { When } = require('@cucumber/cucumber');

When(
  'resource {word} is applied:',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} alias
   * @param {string} manifest
   * @returns {Promise}
   */
  async function(alias, manifest) {
    await this.applyWatchedManifest(alias, manifest);
  }
);

When(
  'resource {word} is created:',
  /**
   * @this import("../support/world.cjs").MyWorld
   * @param {string} alias
   * @param {string} manifest
   * @returns {Promise}
   */
  async function(alias, manifest) {
    await this.applyWatchedManifest(alias, manifest, true);
  }
);
