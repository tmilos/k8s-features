const assert = require('node:assert');
const { ListWatch, Watch, KubernetesObject, V1APIResource, KubeConfig } = require('@kubernetes/client-node');
const { getListFn } = require('../k8s/list.cjs');
const { KindToResourceMapper } = require('../k8s/kindToResourceMapper.cjs');
const { sleep } = require('../util/sleep.cjs');
const { logger } = require('../util/logger.cjs');

class ResourceDeclaration {

  deleteOnFinish = false;

  /**
   * @param {string} alias
   * @param {string} kind
   * @param {string} apiVersion
   * @param {string} name
   * @param {string | undefined} namespace
   */
  constructor(alias, kind, apiVersion, name, namespace = undefined) {
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
     * @type {V1APIResource | undefined}
     */
    this.resource = undefined;

    /**
     * @type {string}
     */
    this.name = name;

    /**
     * @type {string}
     */
    this.namespace = namespace;

    /**
     * @type {KubernetesObject | undefined}
     */
    this.obj = undefined;

    this.deleteOnFinish = false;

    this.evaluated = false;
  }

  /**
   *
   * @returns {KubernetesObject | undefined}
   */
  getObj() {
    return this.obj;
  }

  /**
   * @returns {string}
   */
  key() {
    const result = `${this.apiVersion}/${this.kind}/${this.namespace}/${this.name}`;
    return result;
  }

}

class WatchedResources {
  /**
   * @param {import('./world.cjs').MyWorld} world
   * @param {KubeConfig} kc
   */
  constructor(world, kc) {
    this.started = false;

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
     * Map of alias => ResourceDeclaration
     * @type {Map<string, ResourceDeclaration>}
     * @readonly
     * @private
     */
    this.items = new Map();

    /**
     * @private
     */
    this._watchCount = 0;

    /**
     * @type {Map<string, string>}
     */
    this._evaluationErrorCache = new Map();
  }

  /**
   *
   * @returns {ResourceDeclaration[]}
   */
  getCreatedItems() {
    /** @type {ResourceDeclaration[]} */
    let result = [];
    /** @type {ResourceDeclaration[]} */
    const items = this.items.values();
    for (let item of items) {
      if (item.deleteOnFinish) {
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
   * @returns {void}
   */
  add(alias, kind, apiVersion, name, namespace) {
    const rx = /.+/;
    if (this.items.has(alias)) {
      assert.fail(`Resource ${alias} already declared`);
    }
    assert.match(alias, rx, "Alias must not be an empty string");
    assert.match(kind, rx, "Kind must not be an empty string");
    assert.match(apiVersion, rx, "ApiVersion must not be an empty string");
    assert.match(name, rx, "Name must not be an empty string");

    this.items.set(alias, new ResourceDeclaration(alias, kind, apiVersion, name, namespace));
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
    const ctx = {
      _: {},
    };
    for (/** @type [string, ResourceDeclaration] */ let [alias, item] of this.items) {
      const obj = item.getObj();
      ctx[alias] = obj;
      ctx._[alias] = {
        apiVersion: item.apiVersion,
        kind: item.kind,
        name: item.name,
        namespace: item.namespace,
        evaluated: item.evaluated,
        deleteOnFinish: item.deleteOnFinish,
        resource: item.resource,
        obj,
      };
    }
    return ctx
  }

  /**
   * @private
   */
  async _watchInterval() {
    const exit = (function() {
      this._watchCount++;
    }).bind(this);

    if (!this.started) {
      return exit();
    }

    for (let item of this.items.values()) {
      if (!this.started) {
        return exit();
      }

      if (!item.resource) {
        try {
          item.resource = await this.resourceMapper.getResourceFromKind(item.apiVersion, item.kind);
        } catch (err) {
          item.obj = undefined;
          continue;
        }
      }

      if (!item.evaluated) {
        try {
          const nameEvaluated = this.world.templateWithThrow(item.name);
          if (!nameEvaluated || nameEvaluated.includes('undefined')) {
            throw new Error('empty name');
          }
          item.name = nameEvaluated;
          if (item.resource.namespaced) {
            if (item.namespace) {
              const namespaceEvaluated = this.world.templateWithThrow(item.namespace);
              if (!namespaceEvaluated || namespaceEvaluated.includes('undefined')) {
                throw new Error('empty namespace');
              }
              item.namespace = namespaceEvaluated;
            } else {
              item.namespace = this.world.parameters.namespace ?? 'default';
            }
          } else {
            item.namespace = '';
          }
          item.evaluated = true;
          this._evaluationErrorCache.delete(item.alias);
          logger.info('Watched resource evaluated', {
            alias: item.alias,
            kind: item.kind,
            apiVersion: item.apiVersion,
            name: item.name,
            namespace: item.namespace,
          });
        } catch (err) {
          const keyObj = {
            msg: `Error evaluating item ${item.alias}: ${err}`,
            err,
          };
          const key = JSON.stringify(keyObj);
          if (!this._evaluationErrorCache.has(item.alias) || this._evaluationErrorCache.get(item.alias) != key) {
            this._evaluationErrorCache.set(item.alias, key);
            logger.info(keyObj.msg, {
              alias: item.alias,
              kind: item.kind,
              apiVersion: item.apiVersion,
              name: item.name,
              namespace: item.namespace,
              errTxt: `${err}`,
              err,
            });
          }
          item.obj = undefined;
          continue;
        }
      }

      const spec = {
        apiVersion: item.apiVersion,
        kind: item.kind,
        metadata: {
          name: item.name,
        }
      };
      if (!spec.apiVersion || !spec.kind || !spec.metadata.name) {
        item.obj = undefined;
        continue;
      }
      if (item.resource.namespaced) {
        spec.metadata.namespace = item.namespace;
      }

      const oldObj = item.obj;

      try {
        const resp = await this.world.api.read(spec);
        if (resp.body) {
          item.obj = resp.body;
          if (!oldObj) {
            logger.info('Non-existing resource created', {
              alias: item.alias,
              kind: item.kind,
              apiVersion: item.apiVersion,
              name: item.name,
              namespace: item.namespace,
              state: item.obj.status ? item.obj.status.state : '',
              conditions: item.obj.status && item.obj.status.conditions ?
                item.obj.status.conditions.map(c => `{${c.type}/${c.reason}/${c.message}}`) : '',
            });
          }
        } else {
          item.obj = undefined;
        }
      } catch (err) {
        if (oldObj) {
          logger.info('Existing resource deleted', {
            alias: item.alias,
            kind: item.kind,
            apiVersion: item.apiVersion,
            name: item.name,
            namespace: item.namespace,
          });
        }
        item.obj = undefined; // err.statusCode == 404
        continue;
      }
    }

    if (!this.started) {
      return exit();
    }

    const repeat = function() {
      this._watchInterval();
    }

    setTimeout(repeat.bind(this), 1000);

    exit();
  }

  /**
   * Blocks until watch loop has run at least once, so that all declareed items
   * have fresh values.
   * @returns {Promise<void>}
   */
  async startWatches() {
    const seenCount = this._watchCount;
    if (!this.started) {
      this.started = true;
      this._watchInterval();
    }
    while (seenCount + 1 >= this._watchCount) {
      await sleep(300);
    }
  }

  /**
   * Blocks until watch loop is stopped so watched items will not change anymore
   * @returns {Promise<void>}
   */
  async stopWatches() {
    if (!this.started) {
      await sleep(1000);
      return;
    }

    const seenCount = this._watchCount;
    this.started = false;
    while (seenCount == this._watchCount) {
      await sleep(300);
    }
  }

}

module.exports = {
  ResourceDeclaration,
  WatchedResources,
};
