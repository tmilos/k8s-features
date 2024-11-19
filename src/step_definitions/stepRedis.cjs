const { DataTable, Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');
const { redisCmd } = require('../support/stepRedis.cjs');

/*
    Then Redis "PING" gives "PONG" with:
      | Host    | Secret | `redis.metadata.name` | host       |
      | Port    | Secret | `redis.metadata.name` | port       |
      | Auth    | Secret | `redis.metadata.name` | authString |
      | TLS     | True   |                       |            |
      | CA      | Secret | `redis.metadata.name` | CaCert.pem |
      | Version | 7.4    |                       |            |
*/
Then(
  'Redis {string} gives {string} with:',
  /**
   * @this MyWorld
   * @param {string} cmd
   * @param {string} expectedOutput
   * @param {DataTable} dataTable
   * @returns {Promise}
   */
  async function (cmd, expectedOutput, dataTable) {
    await redisCmd(this, cmd, expectedOutput, dataTable);
  }
);
