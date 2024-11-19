const { sleep } = require('./sleep.cjs');

/**
 * @param {function} fn
 * @returns {function}
 */
function retry(fn) {
  return async function () {
    try {
      return await fn(...arguments);
    } catch (err) {
      if (typeof err.statusCode == 'number' && err.statusCode == 404) {
        throw err;
      }
      await sleep(300);
      return await fn(...arguments);
    }
  }
}

module.exports = {
  retry,
};
