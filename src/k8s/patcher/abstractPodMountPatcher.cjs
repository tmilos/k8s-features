const { KubernetesObject } = require('@kubernetes/client-node');
const { AbstractKubernetesObjectPatcher } = require('./types.cjs');
const assert = require('node:assert');

/**
 * @abstract
 */
class AbstractPodMountPatcher extends AbstractKubernetesObjectPatcher {

  /**
   * @param {string} volumeName
   * @param {string} mountPath
   */
  constructor(volumeName, mountPath) {
    super();
    assert.ok(volumeName, 'volumeName must be specified');
    this.volumeName = volumeName;
    this.mountPath = mountPath ?? '/mnt';
  }

  /**
   * @abstract
   * @param {KubernetesObject} obj
   */
  patch(obj) {
    if (obj.kind !== 'Pod') {
      throw new Error(`Expecting Pod kind, but got ${obj.kind}`);
    }
    const pod = obj;
    if (!pod || !pod.spec || !pod.spec.containers || pod.spec.containers.length < 1) {
      throw new Error('Pod has no container');
    }
    if (!pod.spec.containers[0].volumeMounts) {
      pod.spec.containers[0].volumeMounts = [];
    }
    pod.spec.containers[0].volumeMounts.push({
      name: this.volumeName,
      mountPath: `${this.mountPath}/${this.volumeName}`,
    });
    if (!pod.spec.volumes) {
      pod.spec.volumes = [];
    }
  }
}

module.exports = {
  AbstractPodMountPatcher,
};
