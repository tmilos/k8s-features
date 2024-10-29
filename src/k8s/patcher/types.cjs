const { KubernetesObject } = require('@kubernetes/client-node');

/**
 * @interface
 */
class AbstractKubernetesObjectPatcher {
  /**
   * @param {KubernetesObject} obj
   */
  patch(obj) {
    throw new Error('Abstract method');
  }
}

module.exports = {
  AbstractKubernetesObjectPatcher,
};
