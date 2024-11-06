const { setWorldConstructor, Before, setDefaultTimeout, After } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');


setWorldConstructor(MyWorld);

setDefaultTimeout(60 * 60 * 1000);

Before(
  /**
   * @this MyWorld
   * @returns {Promise}
   */
  async function() {
  if (!this.parameters.namespace || this.parameters.namespace == '') {
    this.parameters.namespace = 'default';
  }
  await this.init();
});

After(
  /**
   * @this MyWorld
   * @returns {Promise}
   */
  async function () {
    this.stopped = true;
    if (!(('messy' in this.parameters) && this.parameters.messy)) {
      await this.deleteCreatedResources();
    }
    await this.stopWatches();
  }
);

