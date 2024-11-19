const { KubernetesObject } = require('@kubernetes/client-node');
const { AbstractKubernetesObjectPatcher } = require('./types.cjs');

class PodEnvFixedPatcher extends AbstractKubernetesObjectPatcher {
  /**
   *
   * @param {string} name
   * @param {string} value
   */
  constructor(name, value) {
    super();
    this.name = name;
    this.value = value;
  }

  /**
   *
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
    if (!pod.spec.containers[0].env || !Array.isArray(pod.spec.containers[0].env)) {
      pod.spec.containers[0].env = []
    }

    pod.spec.containers[0].env.push({
      name: this.name,
      value: this.value,
    });
  }
}

module.exports = {
  PodEnvFixedPatcher,
};
