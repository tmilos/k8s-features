const { KubeConfig, V1APIResource, V1APIResourceList } = require('@kubernetes/client-node');
const { getAsync } = require('./http.cjs');

/**
 * @typedef ListResponseType
 * @property {import('node:http').IncomingMessage} response
 * @property {V1APIResourceList} body
 */

class KindToResourceMapper {

  /**
   * 
   * @param {KubeConfig} kc 
   */
  constructor(kc) {
    /**
     * @type {KubeConfig}
     */
    this.kc = kc;
    /**
     * @type {Object.<string, V1APIResourceList>}
     * @private
     * @readonly
     */
    this.cache = {};

    this.opts = undefined;
  }

  /**
   * @param {string} apiVersion 
   * @returns {Promise<V1APIResource[]>}
   */
  async getAllResourcesFromApiVersion(apiVersion) {
    if (this.cache[apiVersion]) {
      return this.cache[apiVersion].resources;
    }

    await this.loadApiVersion(apiVersion);

    return this.cache[apiVersion].resources;
  }

  /**
   * 
   * @param {string} apiVersion 
   * @param {string} kind 
   * @returns {Promise<V1APIResource | undefined>}
   */
  async getResourceFromKind(apiVersion, kind) {
    if (this.cache[apiVersion]) {
      const resource = this.cache[apiVersion].resources.find((r) => r.kind === kind);
      if (resource) {
          return resource;
      }
    }

    await this.loadApiVersion(apiVersion);

    const resource = this.cache[apiVersion].resources.find((r) => r.kind === kind);
    if (resource) {
        return resource;
    }

    return undefined;
  }

  /**
   * @param {string} apiVersion 
   * @returns {Promise<void>}
   * @protected
   */
  async loadApiVersion(apiVersion) {
    const url = this.apiVersionUrl(this.kc.getCurrentCluster().server, apiVersion);
    if (!this.opts) {
      this.opts = {};
      await this.kc.applyToHTTPSOptions(this.opts);
    }
    /**
     * @type {ListResponseType}
     */
    const resp = await getAsync(url, this.opts);
    this.cache[apiVersion] = resp.body;
  }

  /**
   * 
   * @param {string} basePath 
   * @param {string} apiVersion 
   * @returns {string}
   * @protected
   */
  apiVersionUrl(basePath, apiVersion) {
    const api = apiVersion.includes('/') ? 'apis' : 'api';
    return [basePath, api, apiVersion].join('/');
  }

}

module.exports = {
  KindToResourceMapper,
};
