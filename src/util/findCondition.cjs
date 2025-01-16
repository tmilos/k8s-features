
/**
 *
 * @param {Object|import("@kubernetes/client-node").KubernetesObject} obj
 * @param {string} type
 * @returns {import("@kubernetes/client-node").V1Condition | undefined}
 */
function findCondition(obj, type) {
  if (!obj || !obj.status || !obj.status.conditions || !Array.isArray(obj.status.conditions)) {
    return undefined;
  }
  for (let cond of obj.status.conditions) {
    if (cond.type == type) {
      return cond;
    }
  }
  return undefined;
}

/**
 *
 * @param {Object|import("@kubernetes/client-node").KubernetesObject} obj
 * @param {string} type
 * @returns {import("@kubernetes/client-node").V1Condition | undefined}
 */
function findConditionTrue(obj, type) {
  const cond = findCondition(obj, type);
  if (cond && cond.status == 'True') {
    return cond;
  }
  return undefined;
}

module.exports = {
  findCondition,
  findConditionTrue,
};
