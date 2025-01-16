const { Then } = require('@cucumber/cucumber');
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
   * @this import("../support/world.cjs").MyWorld
   * @param {string} cmd
   * @param {string} expectedOutput
   * @param {import("@cucumber/cucumber").DataTable} dataTable
   * @returns {Promise}
   */
  async function (cmd, expectedOutput, dataTable) {
    await redisCmd(this, cmd, expectedOutput, dataTable);
  }
);
