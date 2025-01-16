const { AbstractPodMountPatcher } = require('./abstractPodMountPatcher.cjs');

class PodMountPvcPatcher extends AbstractPodMountPatcher {

  /**
   *
   * @param {string} pvcName
   * @param {string|undefined} volumeName
   * @param {string|undefined} mountPath
   */
  constructor(pvcName, volumeName, mountPath) {
    super(volumeName ?? pvcName, mountPath);
    this.pvcName = pvcName;
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
      persistentVolumeClaim: {
        claimName: this.pvcName,
      },
    });
  }

}

module.exports = {
  PodMountPvcPatcher,
};
