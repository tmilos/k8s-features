const { AbstractFileOperation } = require('./fileOperation.cjs');

class DeleteFileOperation extends AbstractFileOperation {

  /**
   *
   * @param {string} rootDir
   * @returns {string[]}
   */
  bash(rootDir) {
    return [
      `rm -rf ${rootDir}/${this.path}`,
    ];
  }
}

module.exports = {
  DeleteFileOperation,
};
