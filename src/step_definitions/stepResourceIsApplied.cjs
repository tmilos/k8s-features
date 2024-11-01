const { When } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

When(
  'resource {word} is applied:', 
  /**
   * @this MyWorld
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
   * @this MyWorld
   * @param {string} alias 
   * @param {string} manifest 
   * @returns {Promise}
   */
  async function(alias, manifest) {
    await this.applyWatchedManifest(alias, manifest, true);
  }
);
