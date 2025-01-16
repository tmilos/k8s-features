const { AbstractPodMountPatcher } = require('./abstractPodMountPatcher.cjs');

class PodMountConfigMapPatcher extends AbstractPodMountPatcher {

  /**
   *
   * @param {string} configMapName
   * @param {string|undefined} volumeName
   * @param {string|undefined} mountPath
   * @param {number|undefined} defaultMode defaults to 0o644
   */
  constructor(configMapName, volumeName, mountPath, defaultMode) {
    super(volumeName ?? configMapName, mountPath);
    this.configMapName = configMapName;
    this.defaultMode = defaultMode ?? 0o644;
  }

  /**
   *
   * @param {import("@kubernetes/client-node").KubernetesObject} obj
   */
  patch(obj) {
    super.patch(obj);
    const pod = obj;
    pod.spec.volumes.push({
      name: this.volumeName,
      configMap: {
        name: this.configMapName,
        defaultMode: this.defaultMode,
      },
    });
  }

}

module.exports = {
  PodMountConfigMapPatcher,
};
