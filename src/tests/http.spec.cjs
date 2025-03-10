const { DataTable } = require('@cucumber/cucumber');
const { HttpOptions } = require('../support/http.cjs');
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

  it('can http get succesfully', async () => {
    const options = new HttpOptions();
    options.url = 'http://httpbin.httpbin.svc.cluster.local:8000/base64/SFRUUEJJTiBpcyBhd2Vzb21l';
    await world.http(options);
  });

  it('can http get with expected output succesfully', async () => {
    const options = new HttpOptions();
    options.url = 'http://httpbin.httpbin.svc.cluster.local:8000/base64/SFRUUEJJTiBpcyBhd2Vzb21l';
    options.expectedOutput = 'HTTPBIN is awesome';
    await world.http(options);
  });

  it('can http get with data table succesfully', async () => {
    world.parameters = {
      ...(world.parameters ?? {}),
      peeringTarget: 'httpbin.httpbin.svc.cluster.local:8000',
    };
    const dataTable = new DataTable([
      ['Url', 'http://${params.peeringTarget}/base64/SFRUUEJJTiBpcyBhd2Vzb21l'],
      ['ExpectedOutput', 'HTTPBIN is awesome'],
    ])
    const options = new HttpOptions();
    options.loadFromDataTable(world, dataTable);
    await world.http(options);
  });

});
