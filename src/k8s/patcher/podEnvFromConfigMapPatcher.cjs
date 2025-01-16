const { AbstractKubernetesObjectPatcher } = require('./types.cjs');

class PodEnvFromConfigMapPatcher extends AbstractKubernetesObjectPatcher {

  /**
   *
   * @param {string} name
   * @param {string} configMapName
   * @param {string} key
   */
  constructor(name, configMapName, key) {
    super();
    this.name = name;
    this.configMapName = configMapName;
    this.key = key;
  }

  /**
   *
   * @param {import("@kubernetes/client-node").KubernetesObject} obj
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
      valueFrom: {
        configMapKeyRef: {
          key: this.key,
          name: this.configMapName,
        },
      },
    });
  }
}

module.exports = {
  PodEnvFromConfigMapPatcher,
};
