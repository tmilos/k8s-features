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

    /**
     * @type {WatchedResources | undefined}
     */
    this.watchedResources = undefined;
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
    //console.log(`eventually value is ${actualExp}, unless: ${unlessExpressions.join('; ')}`);
    return new Promise(async (resolve, reject) => {
      while (!this.stopped) {
        const actual = this.eval(actualExp);
        if (actual) {
          resolve();
          return;
        }
        for (let unlessExp of unlessExpressions) {
          const unlessValue = this.eval(unlessExp);
          if (unlessValue) {
            reject(new Error(`unless expression "${unlessExp}" is ok`));
            return;
          }
        }

        await sleep(this.eventuallyPeriodMs);
      }
      resolve();
    });
  }

  /**
   * @returns {Promise}
   */
  async deleteCreatedResources() {
    if (!this.watchedResources) {
      throw new Error('It seems init() method was not called in Before hook');
    }
    console.log('Deleting created resources...');
    for (let item of this.watchedResources.getCreatedItems()) {
      const obj = item.getObj();
      if (obj) {
        try {
          await this.api.delete(obj);
        } catch (e) {
          throw new Error(`Error deleting ${item.alias} of kind ${item.kind} in group ${item.apiVersion}: ${e}`);
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
   * @returns {Promise}
   */
  async applyObject(obj, item) {
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

    if (item) {
      item.created = true;
    }
  }

  /**
   * 
   * @param {string} manifest 
   * @param {ResourceDeclaration | undefined} item 
   * @returns {Promise}
   */
  async applyYamlManifest(manifest, item) {
    manifest = this.template('`'+manifest+'`');
    /**
     * @type {KubernetesObject}
     */
    const obj = yamlParse(manifest);
    await this.applyObject(obj, item);
  }

  /**
   * 
   * @param {string} alias 
   * @param {string} manifest 
   * @returns {Promise}
   */
  async applyWatchedManifest(alias, manifest) {
    const item = this.getItem(alias);
    if (!item) {
      throw new Error(`The resource ${alias} is not declated`);
    }

    await this.applyYamlManifest(manifest, item);
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
   * 
   * @param {string} alias 
   * @returns {Promise}
   */
  async eventuallyResourceDoesNotExist(alias) {
    const startDate = new Date();
    
    while (!this.stopped) {
      const item = this.getItem(alias);
      if (!item) {
        throw new Error(`Item ${alias} is not watched`);
      }
      const obj = item.getObj();
      if (!obj) {
        return;
      }
      const endDate = new Date();
      const diffSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
      if (diffSeconds > 3600) {
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
   * 
   * @param {string} alias 
   * @param {string} path 
   * @returns {Promise<string>}
   */
  async listPvcFiles(alias, path = '') {
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

    const scriptLines = [`ls -1 ${path}`];

    await this.watchedResources.add(name, 'Pod', 'v1', name, namespace);
    await this.watchedResources.startWatches();

    await this.createPod(name, namespace, scriptLines, 'ubuntu', new PodMountPvcPatcher(pvcObj.metadata.name));

    await this.eventuallyValueIsOk(
      `${name}.status.phase == "Succeeded"`, 
      `${name}.status.phase == "Failed"`
    );

    const logs = await this.getLogs(name, namespace, name);

    return logs;
  }

}

module.exports = {
  MyWorld,
};
