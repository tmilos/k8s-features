
class AbstractFileOperation {
  /**
   *
   * @param {string} path
   */
  constructor(path) {
    if (path.startsWith('/')) {
      path = path.slice(1);
    }
    this.path = path;
  }

  /**
   * @param {string} rootDir
   * @returns {string[]}
   */
  bash(rootDir) {
    throw new Error('Abstract method');
  }
}

module.exports = {
  AbstractFileOperation,
};
