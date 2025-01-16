
/**
 * @interface
 */
class AbstractKubernetesObjectPatcher {
  /**
   * @param {import("@kubernetes/client-node").KubernetesObject} obj
   */
  patch() {
    throw new Error('Abstract method');
  }
}

module.exports = {
  AbstractKubernetesObjectPatcher,
};
