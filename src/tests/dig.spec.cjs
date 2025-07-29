const { DataTable } = require('@cucumber/cucumber');
const { DigOptions } = require('../support/dig.cjs');
const { MyWorld } = require('../support/world.cjs');
const { logger } = require('../util/logger.cjs');

describe('world.http', function() {

  /** @type {MyWorld} */
  let world;

  beforeAll(async () => {
    logger.silent = true;
    world = new MyWorld({});
    await world.init();
    world.unlessFailureTimeoutSeconds = 1;
  });

  afterAll(async () => {
    if (world) {
      await world.stopWatches();
    }
  });

  it('can dig succesfully', async () => {
    const options = new DigOptions();
    options.domain = 'static-httpbin.httpbin.svc.cluster.local';
    await world.dig(options);
  });

  it('can dig with expected output succesfully', async () => {
    const options = new DigOptions();
    options.domain = 'static-httpbin.httpbin.svc.cluster.local';
    options.expectedOutput = '10.96.48.1';
    await world.dig(options);
  });

  it('can dig with data table succesfully', async () => {
    world.parameters = {
      ...(world.parameters ?? {}),
      domain: 'static-httpbin.httpbin.svc.cluster.local',
    };
    const dataTable = new DataTable([
      ['Domain', '${params.domain}'],
      ['ExpectedOutput', '10.96.48.1'],
    ])
    const options = new DigOptions();
    options.loadFromDataTable(world, dataTable);
    await world.dig(options);
  });

});
