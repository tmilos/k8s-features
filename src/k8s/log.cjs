const { KubeConfig, Log } = require('@kubernetes/client-node');
const { WritableStreamBuffer } = require('stream-buffers');
const { sleep } = require('../util/sleep.cjs');

/**
 * @typedef {LogOptions}
 * @property {number|undefined} limitBytes
 * @property {boolean|undefined} pretty
 * @property {boolean|undefined} previous
 * @property {number|undefined} sinceSeconds
 * @property {number|undefined} tailLines
 * @property {boolean|undefined} timestamps
 */


/**
 *
 * @param {KubeConfig} kc
 * @param {string} podName
 * @param {string} namespace
 * @param {string} container
 * @param {LogOptions|undefined} opts
 * @returns {Promise<string>}
 */
async function log(kc, podName, namespace, container, opts = undefined) {
  const logClient = new Log(kc);
  const buf = new WritableStreamBuffer();
  if (opts && opts.follow) {
    throw new Error('can not follow logs');
  }
  const req = await logClient.log(namespace, podName, container, buf, opts);
  // not sure how to use logs client w/out follow, the example is not clear
  // if req is not aborted then the buffer is empty
  // adding small sleep just in case
  await sleep(100);
  req.abort();
  const content = buf.getContentsAsString('utf8');
  if (typeof content === 'boolean') {
    return '';
  }
  return content;
}

module.exports = {
  log,
};
