const assert = require('node:assert');
const { ListWatch, Watch, KubernetesObject, ObjectCache, DiscoveryApi, DiscoveryV1Api, V1APIResource, ApisApi, KubeConfig } = require('@kubernetes/client-node');
const { getListFn } = require('../k8s/list.cjs');
const { KindToResourceMapper } = require('../k8s/kindToResourceMapper.cjs');
const { Map } = require('../util/map.cjs');

class ResourceDeclaration {

  created = false;

  /**
   * @param {string} alias 
   * @param {string} kind 
   * @param {string} apiVersion 
   * @param {V1APIResource} resource 
   * @param {string} name 
   * @param {string | undefined} namespace 
   */
  constructor(alias, kind, apiVersion, resource, name, namespace = undefined) {
    /**
     * @type {string}
     */
    this.alias = alias;

    /**
     * @type {string}
     */
    this.kind = kind;
    
    /**
     * @type {string}
     */
    this.apiVersion = apiVersion;
    
    /**
     * @type {V1APIResource}
     */
    this.resource = resource;
    
    /**
     * @type {string}
     */
    this.name = name;
    
    /**
     * @type {string}
     */
    this.namespace = namespace;

    /**
     * @type {string}
     * @readonly
     */
    this.plural = resource.name;

    /**
     * @type {ObjectCache<KubernetesObject> | undefined}
     */
    this.cache = undefined;

    this.created = false;
  }

  /**
   * 
   * @returns {KubernetesObject | undefined}
   */
  getObj() {
    if (this.cache) {
      return this.cache.get(this.name, this.namespace);
    }
  }

  /**
   * 
   * @returns {string}
   */
  k8sWatchPath() {
    let api = this.apiVersion.includes('/') ? 'apis' : 'api';
    let path = `/${api}/${this.apiVersion}`;
    if (this.namespace) {
      path += `/namespaces/${this.namespace}`;
    }
    path += `/${this.plural}`;
    return path;
  }
}

class WatchedResources {
  /**
   * @param {import('./world.cjs').MyWorld} world
   * @param {KubeConfig} kc
   */
  constructor(world, kc) {
    /**
     * @type {import('./world.cjs').MyWorld}
     * @private
     * @readonly
     */
    this.world = world;

    /**
     * @type KindToResourceMapper
     * @private
     * @readonly
     */
    this.resourceMapper = new KindToResourceMapper(kc);

    /**
     * @type {Object.<string, ObjectCache<KubernetesObject>>}
     * @private
     * @readonly
     */
    this.caches = new Map();

    /**
     * Map of alias => ResourceDeclaration
     * @type {Map}
     * @readonly
     * @private
     */
    this.items = new Map();
  }

  /**
   * 
   * @returns {ResourceDeclaration[]}
   */
  getCreatedItems() {
    /**
     * @type {ResourceDeclaration[]}
     */
    let result = [];
    for (let item of this.items.values()) {
      if (item.created) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * 
   * @param {string} alias 
   * @param {string} kind 
   * @param {string} apiVersion 
   * @param {string} name 
   * @param {string} namespace 
   * @returns {Promise}
   */
  async add(alias, kind, apiVersion, name, namespace) {
    const rx = /.+/;
    if (this.items.has(alias)) {
      assert.fail(`Resource ${alias} already declared`);
    }
    assert.match(alias, rx, "Alias must not be an empty string");
    assert.match(kind, rx, "Kind must not be an empty string");
    assert.match(apiVersion, rx, "ApiVersion must not be an empty string");
    assert.match(name, rx, "Name must not be an empty string");

    const resource = await this.resourceMapper.getResourceFromKind(apiVersion, kind);
    if (!resource) {
      throw new Error(`Unable to find resource ${kind} in ${apiVersion}`);
    }

    if (resource.namespaced && !namespace) {
      namespace = this.world.parameters.namespace;
    }

    this.items.set(alias, new ResourceDeclaration(alias, kind, apiVersion, 
      resource, name, namespace));
  }

  /**
   * 
   * @param {string} apiVersion 
   * @returns {Promise<V1APIResource[]>}
   */
  async getAllResourcesFromApiVersion(apiVersion) {
    return await this.resourceMapper.getAllResourcesFromApiVersion(apiVersion);
  }

  /**
   * 
   * @param {string} alias 
   * @returns {ResourceDeclaration | undefined}
   */
  getItem(alias) {
    return this.items.get(alias);
  }

  /**
   * 
   * @param {string} alias 
   * @returns {KubernetesObject | undefined}
   */
  getObj(alias) {
    const item = this.items.get(alias);
    if (item) {
      return item.getObj();
    }
    return undefined;
  }

  /**
   * @returns <Object>
   */
  contextObjects() {
    const ctx = {};
    for (let [alias, item] of this.items) {
      if (item.cache) {
        ctx[alias] = item.cache.get(item.name, item.namespace);
      }
    }
    return ctx
  }

  /**
   * @returns {Promise<void>}
   */
  async startWatches() {
    // many ResourceDeclaration we're startining to watch now can refer to the same kind
    // thus we will create only one watch per kind
    // and have to keep list of already created watches and not create duplicates
    /**
     * @type {ListWatch<KubernetesObject>[]}
     */
    let createdCaches = [];
    for (let item of this.items.values()) {
      if (item.cache) {
        continue;
      }
      const path = item.k8sWatchPath();
      if (this.caches.has(path)) {
        item.cache = this.caches.get(path);
        continue;
      }

      const kc = await this.world.getKubeConfig();
      const cache = new ListWatch(path, new Watch(kc), getListFn(kc, path), false);
      this.caches.set(path, cache);
      createdCaches.push(cache);
      item.cache = cache;
    }

    return Promise.all(createdCaches.map(c => c.start()));
  }

  /**
   * @returns {Promise<void>}
   */
  async stopWatches() {
    for (let cache of this.caches.values()) {
      await cache.stop();
    }
  }

}

module.exports = {
  ResourceDeclaration,
  WatchedResources,
};
