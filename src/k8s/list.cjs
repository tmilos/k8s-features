const { KubeConfig, KubernetesObject, ListPromise, KubernetesListObject } = require('@kubernetes/client-node');
const { getAsync } = require('./http.cjs');

/**
 * @typedef ListResponseType
 * @property {import('node:http').IncomingMessage} response
 * @property {KubernetesListObject<KubernetesObject>} body
 */

/**
 * 
 * @param {KubeConfig} kc 
 * @param {string} path 
 * @returns {Promise<ListResponseType>|ListPromise<KubernetesObject>}
 */
function getListFn(kc, path) {
  return async () => {
    const opts = {};
    await kc.applyToHTTPSOptions(opts);
  
    const list = await getAsync(`${kc.getCurrentCluster().server}${path}`, opts);
  
    return list;  
  }
}

module.exports = {
  getListFn,
};
