const { sleep } = require('./sleep.cjs');

/**
 * @param {function} fn
 * @returns {function}
 */
function retry(fn) {
  return async function () {
    try {
      return await fn(...arguments);
    } catch {
      await sleep(300);
      return await fn(...arguments);
    }
  }
}

module.exports = {
  retry,
};
