
/**
 * 
 * @param {Object} obj 
 * @param {string|undefined} finalizer 
 * @returns {boolean}
 */
function hasFinalizer(obj, finalizer) {
  if (!obj || !obj.metadata || !obj.metadata.finalizers || !Array.isArray(obj.metadata.finalizers) || obj.metadata.finalizers.length == 0) {
    return false;
  }
  if (!finalizer) {
    return true;
  }
  for (let f of obj.metadata.finalizers) {
    if (f == finalizer) {
      return true;
    }
  }
  return false;
}

module.exports = {
  hasFinalizer,
};
