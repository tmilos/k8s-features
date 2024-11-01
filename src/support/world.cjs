const { World } = require('@cucumber/cucumber');
const { ResourceDeclaration, WatchedResources } = require('./resourceDeclaration.cjs');
const { HttpError, KubeConfig, KubernetesObject, KubernetesObjectApi, PatchUtils, V1APIResource, V1Status } = require('@kubernetes/client-node');
const safeEval = require('safe-eval');
const { ok } = require('assert');
const { sleep } = require('../util/sleep.cjs');
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
    this.api = KubernetesObjectApi.makeApiClient(this.kc);
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
      await this.watchedResources.add(item.alias, item.kind, item.apiVersion, item.name, item.namespace);
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
      namespace: this.parameters.namespace ?? 'default',
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
  template(template) {
    // if starts and ends with backtick ` evaluate it as js template literal
    if (template.startsWith("`") && template.endsWith("`")) {
      return this.eval(template);
    }
    return template;
  }

  /**
   * @param {string} expression 
   * @returns {any}
   */
  eval(expression) {
    const ctx = this.evalContext();
    try {
      return safeEval(expression, ctx);
    } catch (e) {
      return undefined;
    }
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

    while (!this.stopped) {
      const actual = this.eval(actualExp);
      if (actual) {
        return;
      }
      for (let unlessExp of unlessExpressions) {
        const unlessValue = this.eval(unlessExp);
        if (unlessValue) {
          throw new Error(`unless expression "${unlessExp}" is ok`);
          return;
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
      console.log('Deleting created resources...');
      for (let { item, obj } of itemsToDelete) {
        try {
          await this.api.delete(obj);
        } catch (e) {
          console.error(`Failed deleting ${item.alias} of kind ${item.kind} in group ${item.apiVersion}: ${"\n"}${e}`);
          console.log();
        }
        console.log(`${item.alias}   ${obj.apiVersion}/${obj.kind}   ${obj.metadata.namespace ? [obj.metadata.namespace,'/',obj.metadata.name].join('') : obj.metadata.name}`)
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
        console.log('Update error', inspect(err.body), inspect(obj), err.stack);
        throw new Error(`Update error: ${err.body.message}`);
      }
      console.log('Update error', err, inspect(obj));
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
      await this.api.patch(obj, undefined, undefined, 'k8f', true, {
        headers:{
          ['content-type']: PatchUtils.PATCH_FORMAT_APPLY_YAML,
        },
      });
    } catch (err) {
      if (err instanceof HttpError && err.body instanceof V1Status) {
        console.log('Patch error', inspect(err.body), inspect(obj), err.stack);
        throw new Error(`Patch error: ${err.body.message}`);
      }
      console.log('Patch error', err, inspect(obj));
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
    manifest = this.template('`'+manifest+'`');
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
      throw new Error(`The resource ${alias} is not declated`);
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
      console.log(`Error deleting obj: ${err}`);
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
    const cmObj = yamlParse(cmManifest);
    await this.applyObject(cmObj);
  
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
    const podObj = yamlParse(podManifest);

    patches.push(new PodMountConfigMapPatcher(name, name, '/script', 0o744));
    for (let patch of patches) {
      patch.patch(podObj);
    }
  
    await this.applyObject(podObj);

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
      throw new Error(`Resource ${alias} is not declated`);
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

    await this.watchedResources.add(name, 'Pod', 'v1', name, namespace);
    await this.watchedResources.startWatches();

    const {podObj, cmObj} = await this.createPod(name, namespace, scriptLines, 'ubuntu', new PodMountPvcPatcher(pvcObj.metadata.name));

    await this.eventuallyValueIsOk(
      `${name}.status.phase == "Succeeded"`, 
      `${name}.status.phase == "Failed"`
    );

    const logs = await this.getLogs(name, namespace, name);

    await this.delete(podObj);
    await this.delete(cmObj);

    if (logs.indexOf(allDone) !== -1) {
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
        console.log(err);
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
