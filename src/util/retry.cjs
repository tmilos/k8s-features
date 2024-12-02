const { sleep } = require('./sleep.cjs');

/**
 * @template T
 * @param {T} fn
 * @returns {T}
 */
function retry(fn) {
  return async function () {
    try {
      return await fn(...arguments);
    } catch (err) {
      if (typeof err.statusCode == 'number' && err.statusCode >= 500) {
        await sleep(300);

        try {
          return await fn(...arguments);
        } catch (err2) {
          if (typeof err.statusCode == 'number' && err.statusCode >= 500) {
            await sleep(1000);
            return await fn(...arguments);
          }
        }
      }
    }
  }
}

module.exports = {
  retry,
};
