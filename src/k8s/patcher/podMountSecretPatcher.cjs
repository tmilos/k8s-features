const { KubernetesObject } = require('@kubernetes/client-node');
const { AbstractPodMountPatcher } = require('./abstractPodMountPatcher.cjs');

class PodMountSecretPatcher extends AbstractPodMountPatcher {

  /**
   * 
   * @param {string} secretName 
   * @param {string|undefined} volumeName 
   * @param {string|undefined} mountPath 
   */
  constructor(secretName, volumeName, mountPath) {
    super(volumeName ?? secretName, mountPath);
    this.secretName = secretName;
  }

  /**
   * 
   * @param {KubernetesObject} obj 
   */
  patch(obj) {
    super.patch(obj);
    const pod = obj;
    pod.spec.volumes.push({
      name: this.volumeName,
      secret: {
        secretName: this.secretName,
        defaultMode: 0o444,
      },
    });
  }
}

module.exports = {
  PodMountSecretPatcher,
};
