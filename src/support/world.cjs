const { World } = require('@cucumber/cucumber');
const { ResourceDeclaration, WatchedResources } = require('./resourceDeclaration.cjs');
const { HttpError, KubeConfig, KubernetesObject, KubernetesObjectApi, PatchUtils, V1APIResource, V1Status } = require('@kubernetes/client-node');
const safeEval = require('safe-eval');
const { ok } = require('assert');
const { sleep } = require('../util/sleep.cjs');
const { retry } = require('../util/retry.cjs');
const { makeid } = require('../util/makeId.cjs');
const { findCondition, findConditionTrue } = require('../util/findCondition.cjs');
const { hasFinalizer } = require('../util/finalizer.cjs');
const { parse: yamlParse, stringify: yamlStringify } = require('yaml');
const { AbstractKubernetesObjectPatcher } = require('../k8s/patcher/types.cjs');
const { log } = require('../k8s/log.cjs');
const { PodMountPvcPatcher } = require('../k8s/patcher/podMountPvcPatcher.cjs');
const { AbstractFileOperation } = require('../fs/fileOperation.cjs');
const { PodMountConfigMapPatcher } = require('../k8s/patcher/podMountConfigMapPatcher.cjs');
const { inspect } = require('node:util');
const { Clock } = require('../util/clock.cjs');
const { logger } = require('../util/logger.cjs');

/**
 * @typedef IMyWorldParams
 * @property {string} namespace
 * @property {boolean | undefined} messy
 */

/**
 * @typedef IResourceDeclaration
 * @property {string} alias
 * @property {string} kind
 * @property {string} apiVersion
 * @property {string} name
 * @property {string} namespace
 */


class MyWorld extends World {

  constructor(options) {
    super(options);
    this.stopped = false;
    this.kc = new KubeConfig();

    /**
     * Seconds between unless expression evaluates to true and time
     * when it will be considered as non transient and test fails.
     * @type {number}
     */
    this.unlessFailureTimeoutSeconds = 300;

    /**
     * @type {KubernetesObjectApi | undefined}
     */
    this.api = undefined;

    this.eventuallyPeriodMs = 500;

    this.eventuallyTimeoutSeconds = 3600;

    /**
     * @type {WatchedResources | undefined}
     */
    this.watchedResources = undefined;

    this._clock = new Clock();
  }

  _assertString(val) {
    ok(val);
    ok(val.length);
    ok(typeof val === 'string');
  }

  _assertArrayOfStrings(val, mustHaveLen = true) {
    ok(val);
    ok(Array.isArray(val));
    if (mustHaveLen) {
      ok(val.length);
    }
    val.forEach(x => this._assertString);
  }

  _assertObject(val) {
    ok(val);
    ok(typeof val === 'object');
  }

  _assertArrayOfObjects(val, mustHaveLen = true) {
    ok(val);
    ok(Array.isArray(val));
    if (mustHaveLen) {
      ok(val.length);
    }
    val.forEach(x => this._assertObject);
  }

  /**
   * @param {Clock} clock
   */
  setClock(clock) {
    this._clock = clock;
  }

  getClock() {
    return this._clock;
  }

  /**
   * @returns {Promise}
   */
  async init() {
    this.kc = new KubeConfig();
    this.kc.loadFromDefault();
    if (this.kc.getContexts().length == 0) {
      const user = this.kc.getUsers()[0];
      const cluster = this.kc.getClusters()[0];
      if (!this.kc.getCurrentContext()) {
        this.kc.setCurrentContext(cluster.name);
      }
      this.kc.addContext({
        user: user.name,
        cluster: cluster.name,
        name: this.kc.getCurrentContext(),
      });
    }
    const api = KubernetesObjectApi.makeApiClient(this.kc);
    this.api = {
      create: retry(api.create.bind(api)),
      delete: retry(api.delete.bind(api)),
      patch: retry(api.patch.bind(api)),
      read: retry(api.read.bind(api)),
      list: retry(api.list.bind(api)),
      replace: retry(api.list.bind(api)),
      watch: retry(api.watch.bind(api)),
    };
    this.watchedResources = new WatchedResources(this, this.kc);
  }

  /**
   *
   * @returns {Promise<KubeConfig>}
   */
  async getKubeConfig() {
    return Promise.resolve(this.kc);
  }

  /**
   * @param  {...IResourceDeclaration} resources
   * @returns {Promise}
   */
  async addWatchedResources(...resources) {
    this._assertArrayOfObjects(resources);

    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    for (let item of resources) {
      this.watchedResources.add(item.alias, item.kind, item.apiVersion, item.name, item.namespace);
    }
    await this.watchedResources.startWatches();
  }

  /**
   * @returns {Promise}
   */
  async stopWatches() {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    await this.watchedResources.stopWatches();
  }

  /**
   * @returns {Object}
   */
  evalContext() {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    const ctx = {
      ...this.watchedResources.contextObjects(),
      namespace: (this.parameters && this.parameters.namespace) ?? 'default',
      params: {
        ...this.parameters,
      },
      id: makeid,
      findCondition,
      findConditionTrue,
      hasFinalizer,
    }

    return ctx
  }

  /**
   * @param {string} alias
   * @returns {ResourceDeclaration | undefined}
   */
  getItem(alias) {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    return this.watchedResources.getItem(alias);
  }

  /**
   * @param {string} alias
   * @returns {KubernetesObject | undefined}
   */
  getObj(alias) {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    return this.watchedResources.getObj(alias);
  }

  /**
   * @param {string} template
   * @returns {string}
   */
  templateWithThrow(template) {
    if (!template.startsWith("`") && !template.endsWith("`")) {
      template = '`'+template+'`';
    }
    return this.evalWithThrow(template);
  }

  /**
   * @param {string} expression
   * @returns {any}
   */
  eval(expression) {
    try {
      return this.evalWithThrow(expression);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * @param {string} expression
   * @returns {any}
   */
  evalWithThrow(expression) {
    const ctx = this.evalContext();
    return safeEval(expression, ctx);
  }

  /**
   * @param {string} apiVersion
   * @returns {Promise<V1APIResource[]>}
   */
  async getAllResourcesFromApiVersion(apiVersion) {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    return await this.watchedResources.getAllResourcesFromApiVersion(apiVersion);
  }

  /**
   * @param {string} actualExp
   */
  valueIsOk(actualExp) {
    const actual = this.eval(actualExp);
    ok(actual);
  }

  /**
   * @param {string} actualExp
   * @param  {...string} unlessExpressions
   * @returns {Promise}
   */
  async eventuallyValueIsOk(actualExp, ...unlessExpressions) {
    this._assertArrayOfStrings(unlessExpressions, false);

    /** @type {Map<string, Date>} */
    const failures = new Map();

    while (!this.stopped) {
      const actual = this.eval(actualExp);
      if (actual) {
        return;
      }
      for (let unlessExp of unlessExpressions) {
        const unlessValue = this.eval(unlessExp);

        if (unlessValue) {
          if (!failures.has(unlessExp)) {
            failures.set(unlessExp, new Date());
          }
          const now = new Date();
          const since = failures.get(unlessExp);
          const durationSeconds = (now.getTime() - since.getTime())/1000;
          if (durationSeconds > this.unlessFailureTimeoutSeconds) {
            throw new Error(`unless expression "${unlessExp}" is ok for ${this.unlessFailureTimeoutSeconds} seconds`);
          }
        } else if (failures.has(unlessExp)) {
          failures.delete(unlessExp);
        }
      }

      await sleep(this.eventuallyPeriodMs);
    }
  }

  /**
   * @returns {Promise}
   */
  async deleteCreatedResources() {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    /**
     * @type {Array({item: ResourceDeclaration, obj: KubernetesObject})}
     */
    const itemsToDelete = [];
    for (let item of this.watchedResources.getCreatedItems()) {
      const obj = item.getObj();
      if (obj) {
        itemsToDelete.push({item, obj});
      }
    }

    if (itemsToDelete.length) {
      for (let { item, obj } of itemsToDelete) {
        logger.info('Deleting created resource', {
          alias: item.alias,
          kind: item.kind,
          apiVersion: item.apiVersion,
          name: item.name,
          namespace: item.namespace,
        });
        try {
          await this.api.delete(obj);
        } catch (e) {
          logger.error('Failed deleting created resource', err, {
            alias: item.alias,
            kind: item.kind,
            apiVersion: item.apiVersion,
            name: item.name,
            namespace: item.namespace,
          });
        }
      }
    }
  }

  /**
   *
   * @param {KubernetesObject} obj
   * @param {ResourceDeclaration | undefined} item
   * @returns {Promise}
   */
  async update(obj, item) {
    if (item) {
      if (!obj.metadata) {
        obj.metadata = {};
      }
      obj.metadata.name = item.name;
      if (item.namespace) {
        obj.metadata.namespace = item.namespace;
      }
      if (!obj.apiVersion) {
        obj.apiVersion = item.apiVersion;
      }
      if (!obj.kind) {
        obj.kind = item.kind;
      }
    }

    ok(obj.apiVersion, 'Required field missing: apiVersion');
    ok(obj.kind, 'Required field missing: kind');
    ok(obj.metadata?.name, 'Required field missing: metadata.name');

    try {
      await this.api.replace(obj, undefined, undefined, 'k8f');
    } catch (err) {
      if (err instanceof HttpError && err.body instanceof V1Status) {
        logger.error('Update error', {
          obj,
          errBody: err.body,
          errStack: err.stack,
        })
        throw new Error(`Update error: ${err.body.message}`);
      }
      logger.error('Update error', err, {
        obj,
      })
      throw new Error(`Update error: ${err}`);
    }
  }

  /**
   *
   * @param {KubernetesObject} obj
   * @param {ResourceDeclaration | undefined} item
   * @param {boolean} deleteOnFinish
   * @returns {Promise}
   */
  async applyObject(obj, item, deleteOnFinish = false) {
    if (item) {
      // wait for one watch loop to eventually get items evaluated if not so far
      await this.watchedResources.startWatches();

      if (!item.evaluated) {
        throw new Error(`Declared resource ${item.alias} is not evaluated - ie its apiVersion and kind not observed in the cluster, or its name and namespace not evaluated`);
      }
      if (!obj.metadata) {
        obj.metadata = {};
      }
      if (obj.metadata.name) {
        throw new Error(`Declated resource ${item.alias} has name set, and it needs to be empty since name is defined in the resource declaration`);
      }
      if (obj.metadata.namespace) {
        throw new Error(`Declated resource ${item.alias} has namespace set, and it needs to be empty since namespace is defined in the resource declaration`);
      }
      obj.metadata.name = item.name;
      if (item.resource.namespaced) {
        if (item.namespace) {
          obj.metadata.namespace = item.namespace;
        } else {
          item.namespace = this.parameters.namespace ?? 'default';
          obj.metadata.namespace = item.namespace;
        }
      }
      if (!obj.apiVersion) {
        obj.apiVersion = item.apiVersion;
      }
      if (!obj.kind) {
        obj.kind = item.kind;
      }

      if (obj.apiVersion != item.apiVersion) {
        throw new Error(`Declared resource ${item.alias} apiVersion is ${item.apiVersion} while given manifest apiVersin is ${obj.apiVersion}`);
      }
      if (obj.kind != item.kind) {
        throw new Error(`Declared resource ${item.alias} kind is ${item.kind} while given manifest kind is ${obj.kind}`);
      }
    }

    ok(obj.apiVersion, 'Required field missing: apiVersion');
    ok(obj.kind, 'Required field missing: kind');
    ok(obj.metadata?.name, 'Required field missing: metadata.name');

    try {
      await this.api.patch(obj, undefined, undefined, 'k8f', true, {
        headers:{
          ['content-type']: PatchUtils.PATCH_FORMAT_APPLY_YAML,
        },
      });
    } catch (err) {
      if (err instanceof HttpError && err.body instanceof V1Status) {
        logger.error('Patch error', {
          obj,
          errBody: err.body,
          errStack: err.stack,
        });
        throw new Error(`Patch error: ${err.body.message}`);
      }
      logger.error('Patch error', err, {
        obj,
      })
      throw new Error(`Patch error: ${err}`);
    }

    if (deleteOnFinish == true) {
      item.deleteOnFinish = true;
    }
  }

  /**
   *
   * @param {string} manifest
   * @param {ResourceDeclaration | undefined} item
   * @param {boolean | undefined} deleteOnFinish
   * @returns {Promise}
   */
  async applyYamlManifest(manifest, item, deleteOnFinish = false) {
    manifest = this.templateWithThrow('`'+manifest+'`');
    /**
     * @type {KubernetesObject}
     */
    const obj = yamlParse(manifest);
    await this.applyObject(obj, item, deleteOnFinish);
  }

  /**
   *
   * @param {string} alias
   * @param {string} manifest
   * @param {boolean|undefined} deleteOnFinish
   * @returns {Promise}
   */
  async applyWatchedManifest(alias, manifest, deleteOnFinish = false) {
    const item = this.getItem(alias);
    if (!item) {
      throw new Error(`The resource ${alias} is not declared`);
    }

    await this.applyYamlManifest(manifest, item, deleteOnFinish);
  }

  /**
   *
   * @param {KubernetesObject} obj
   * @returns {Promise}
   */
  async delete(obj) {
    try {
      await this.api.delete(obj);
    } catch (err) {
      logger.error('Error deleting obj', err, {
        obj,
      });
      throw new Error(`Error deleting obj: ${err}`);
    }
  }

  /**
   * @param {string} alias
   * @returns {Promise}
   */
  async eventuallyResourceDoesNotExist(alias) {
    const startTime = this.getClock().getTime();

    while (!this.stopped) {
      const item = this.getItem(alias);
      if (!item) {
        throw new Error(`Item ${alias} is not watched`);
      }
      const obj = item.getObj();
      if (!obj) {
        return;
      }
      const endTime = this.getClock().getTime();
      const diffSeconds = (endTime - startTime) / 1000;
      if (diffSeconds > this.eventuallyTimeoutSeconds) {
        throw new Error(`Timeout waiting for ${alias} to be deleted`);
      }
      await sleep(this.eventuallyPeriodMs);
    } // while

  }

  /**
   *
   * @param {string} alias
   */
  resourceDoesNotExist(alias) {
    const item = this.getItem(alias);
    if (!item) {
      throw new Error(`Item ${alias} is not declared`);
    }
    const obj = item.getObj();
    if (obj) {
      throw new Error(`Item ${alias} exists, but it's expected it does not exist`);
    }
  }

  /**
   *
   * @param {string} podName
   * @param {string} namespace
   * @param {string} containerName
   * @param {number} tailLines
   * @returns {Promise<string>}
   */
  async getLogs(podName, namespace, containerName, tailLines = 100) {
    return await log(this.kc, podName, namespace, containerName, {tailLines: tailLines});
  }

  /**
   * Rejects if specified container/pod does not contain given content
   * @param {string} alias
   * @param {string} containerName
   * @param {string} content
   * @returns {Promise<void>}
   */
  async assertLogsContain(alias, containerName, content) {
    this._assertString(alias);
    this._assertString(content);

    const item = this.getItem(alias);
    if (!item) {
      throw new Error(`Item ${alias} is not declated`);
    }
    if (!item.evaluated) {
      throw new Error(`Item ${alias} is not evaluated`);
    }

    const logs = await this.getLogs(item.name, item.namespace, containerName);

    if (logs && logs.includes(content)) {
      return;
    }

    throw new Error(`Container ${containerName} in pod ${alias} expected to have ${content} in logs, but found: ${logs}`);
  }

  /**
   *
   * @param {string} name
   * @param {string} namespace
   * @param {string[]} scriptLines
   * @param {string} image
   * @param  {...AbstractKubernetesObjectPatcher} patches
   * @returns {Promise<{podObj: KubernetesObject, cmObj: KubernetesObject}>}
   */
  async createPod(name, namespace, scriptLines, image = 'ubuntu', ...patches) {
    this._assertArrayOfObjects(patches, false);

    if (!name) {
      throw new Error('Pod to create must have name');
    }
    if (!namespace) {
      throw new Error('Pod to create must have name');
    }
    if (!scriptLines || scriptLines.length == 0) {
      throw new Error('Pod to create must have some script');
    }
    const cmManifest = `
  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: ${name}
    namespace: ${namespace}
    labels:
      app.kubernetes.io/part-of: k8f
  data:
    ${name}.sh: |
      #!/bin/bash
      set -e
${scriptLines.map(l => '      '+l).join("\n")}
`;

    /**
     * @type {KubernetesObject}
     */
    let cmObj;
    try {
      cmObj = yamlParse(cmManifest);
    } catch (err) {
      throw new Error(`Error parsing ConfigMap manifest for createPod: ${err}\n${cmManifest}`, {cause: err});
    }

    try {
      await this.applyObject(cmObj);
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error creating ConfigMap for Pod: ${err}\n${cmManifest}`, {cause: err});
    }

    const podManifest = `
  apiVersion: v1
  kind: Pod
  metadata:
    name: ${name}
    namespace: ${namespace}
  spec:
    containers:
      - name: ${name}
        image: ${image}
        imagePullPolicy: IfNotPresent
        command:
          - "/bin/bash"
        args:
          - "/script/${name}/${name}.sh"
    restartPolicy: Never
`;
    /**
     * @type {KubernetesObject}
     */
    let podObj;
    try {
      podObj = yamlParse(podManifest);
    } catch (err) {
      throw new Error(`Error parsing Pod manifest for createPod: ${err}\n${podManifest}`, {cause: err});
    }

    patches.push(new PodMountConfigMapPatcher(name, name, '/script', 0o744));
    for (let patch of patches) {
      patch.patch(podObj);
    }

    try {
      await this.applyObject(podObj);
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error creating pod: ${err}\n${podManifest}\n---\n${cmManifest}\n`, {cause: err});
    }

    return {podObj, cmObj};
  }

  /**
   *
   * @param {string} alias
   * @param  {...AbstractFileOperation} fileOperations
   * @returns {Promise}
   */
  async pvcFileOperations(alias, ...fileOperations) {
    this._assertArrayOfObjects(fileOperations);

    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }

    const item = this.getItem(alias);
    if (!item) {
      throw new Error(`Resource ${alias} is not declared`);
    }
    if (item.kind !== 'PersistentVolumeClaim') {
      throw new Error(`Resource ${alias} must be PersistentVolumeClaim, but it is ${item.kind}`);
    }
    const pvcObj = item.getObj();
    if (!pvcObj) {
      throw new Error(`Resource ${alias} does not exist`);
    }
    if (!pvcObj.metadata?.name) {
      throw new Error(`PVC ${alias} has no name`);
    }
    if (!pvcObj.metadata?.namespace) {
      throw new Error(`PVC ${alias} has no namespace`);
    }

    const name = `k8f${makeid(8)}`;
    const namespace = pvcObj.metadata.namespace;

    const allDone = 'All done!';
    const rootDir = `/mnt/${pvcObj.metadata.name}`;
    /**
     * @type {string[]}
     */
    const scriptLines = [];
    for (let fileOperation of fileOperations) {
      scriptLines.push(...fileOperation.bash(rootDir));
    }
    scriptLines.push(`echo "${allDone}"`);

    this.watchedResources.add(name, 'Pod', 'v1', name, namespace);
    await this.watchedResources.startWatches();

    /** @type {KubernetesObject} */
    let podObj;
    /** @type {KubernetesObject} */
    let cmObj;
    try {
      ({podObj, cmObj} = await this.createPod(name, namespace, scriptLines, 'ubuntu', new PodMountPvcPatcher(pvcObj.metadata.name)));
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error creating Pod for PVC operation: ${err}`, {cause: err});
    }

    let failed = false;

    try {
      await this.eventuallyValueIsOk(
        `${name}.status.phase == "Succeeded"`,
        `${name}.status.phase == "Failed"`
      );
    } catch {
      failed = true;
    }

    /** @type {string} */
    let logs;
    try {
      logs = await this.getLogs(name, namespace, name);
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error getting Pod logs for PVC operation: ${err}`, {cause: err});
    }

    try {
      await this.delete(podObj);
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error deleting Pod for PVC operation: ${err}`, {cause: err});
    }

    try {
      await this.delete(cmObj);
    } catch (err) {
      console.error(inspect(err));
      throw new Error(`Error deleting ConfigMap for PVC operation: ${err}`, {cause: err});
    }

    if (failed || logs.indexOf(allDone) !== -1) {
      return;
    }

    throw new Error(`PVC ${alias} file operations failed: ${"\n"+logs}`);
  }

  /**
   * @param {string} apiVersion
   * @param {...string} kinds
   * @returns {Promise}
   */
  async kindsExist(apiVersion, ...kinds) {
    this._assertString(apiVersion);
    this._assertArrayOfStrings(kinds);

    const allResources = await this.getAllResourcesFromApiVersion(apiVersion);
    const existingKinds = new Map();
    for (const res of allResources) {
      existingKinds.set(res.kind, true);
    }
    const missingKinds = [];
    for (let kind of kinds) {
      if (!existingKinds.has(kind)) {
        missingKinds.push(kind);
      }
    }
    if (missingKinds.length > 0) {
      throw new Error(`Missing kind: ${missingKinds.join(', ')}`);
    }
  }

  /**
   * @param {string} apiVersion
   * @param {...string} kinds
   * @returns {Promise}
   */
  async kindsDoNotExist(apiVersion, ...kinds) {
    this._assertString(apiVersion);
    this._assertArrayOfStrings(kinds);

    const allResources = await this.getAllResourcesFromApiVersion(apiVersion);
    const existingKinds = new Map();
    for (const res of allResources) {
      existingKinds.set(res.kind, true);
    }
    const unexpectedKinds = [];
    for (let kind of kinds) {
      if (existingKinds.has(kind)) {
        unexpectedKinds.push(kind);
      }
    }
    if (unexpectedKinds.length > 0) {
      throw new Error(`Unexpected kinds: ${unexpectedKinds.join(', ')}`);
    }
  }

  /**
   * @param {string} kind
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async kindExists(kind, apiVersion) {
    try {
      await this.getAllResourcesFromApiVersion(apiVersion);
    } catch (err) {
      if (err.message.includes('status code 404')) {
        throw new Error(`Kind ${kind} of ${apiVersion} does not exist`);
      }
      throw new Error(`Error finding resources in apiVersion ${apiVersion}: ${err.message}`, {cause: err});
    }
  }

  /**
   * @param {string} kind
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async kindDoesNotExist(kind, apiVersion) {
    try {
      await this.getAllResourcesFromApiVersion(apiVersion);
    } catch (err) {
      return;
    }
    throw new Error(`Kind ${kind} of ${apiVersion} exist, but it's expected not to exist.`);
  }

  /**
   * @param {string} kind
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async eventuallyKindExists(kind, apiVersion) {
    const startDate = new Date();
    let list;

    while (true) {
      try {
        list = await this.getAllResourcesFromApiVersion(apiVersion);
      } catch (err) {
        await sleep(this.eventuallyPeriodMs);
        continue;
      }

      for (let res of list) {
        if (res.kind == kind) {
          return;
        }
      }

      const endDate = new Date();
      const diffSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
      if (diffSeconds > this.eventuallyTimeoutSeconds) {
        throw new Error(`Timeout waiting for ${kind} of ${apiVersion} to exist`);
      }

      await sleep(this.eventuallyPeriodMs);
    }
  }

  /**
   * @param {string} kind
   * @param {string} apiVersion
   * @returns {Promise}
   */
  async eventuallyKindDoesNotExist(kind, apiVersion) {
    const startDate = new Date();
    let list;

    while (true) {
      try {
        list = await this.getAllResourcesFromApiVersion(apiVersion);
      } catch (err) {
        if (err.message.includes('status code 404')) {
          return; //apiVersion does not exist
        }
        // not sure what this is, just log it
        logger.error('eventuallyKindDoesNotExist getAllResourcesFromApiVersion error', err, {
          kind,
          apiVersion,
        });
        continue;
      }

      for (let res of list) {
        if (res.kind == kind) {
          // kind still exists
          continue;
        }
      }

      const endDate = new Date();
      const diffSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
      if (diffSeconds > this.eventuallyTimeoutSeconds) {
        throw new Error(`Timeout waiting for ${kind} of ${apiVersion} not to exist`);
      }

      await sleep(this.eventuallyPeriodMs);
    }
  }

  async apiVersionExists(apiVersion) {
    let list;
    try {
      list = await this.getAllResourcesFromApiVersion(apiVersion);
    } catch (err) {
      if (err.message.includes('status code 404')) {
        throw new Error(`Exepected apiVersion ${apiVersion} to exist, but it does not`);
      }
      throw err;
    }
    if (list.length == 0) {
      throw new Error(`Expected apiVersion ${apiVersion} to exists, but it has no kinds`);
    }
  }

  async apiVersionDoesNotExist(apiVersion) {
    let list;
    try {
      list = await this.getAllResourcesFromApiVersion(apiVersion);
    } catch (err) {
      if (err.message.includes('status code 404')) {
        return;
      }
      throw err;
    }
    if (list.length > 0) {
      const kinds = list.map(r => r.kind).join(', ');
      throw new Error(`Expected not to have apiVersion ${apiVersion}, but found kinds: ${kinds}`);
    }
  }
}

module.exports = {
  MyWorld,
};
