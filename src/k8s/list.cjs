const { getAsync } = require('./http.cjs');

/**
 * @typedef ListResponseType
 * @property {import('node:http').IncomingMessage} response
 * @property {import("@kubernetes/client-node").KubernetesListObject<import("@kubernetes/client-node").KubernetesObject>} body
 */

/**
 *
 * @param {import("@kubernetes/client-node").KubeConfig} kc
 * @param {string} path
 * @returns {Promise<ListResponseType>|import("@kubernetes/client-node").ListPromise<import("@kubernetes/client-node").KubernetesObject>}
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
