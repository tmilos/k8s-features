const { AbstractFileOperation } = require('./fileOperation.cjs');

class FileExistsOperation extends AbstractFileOperation {
  /**
   * 
   * @param {string} rootDir 
   * @returns {string[]}
   */
  bash(rootDir) {
    return [
      `[ -e "${rootDir}/${this.path}" ] || (echo "File ${this.path} does not exist"; exit 1)`,
    ];
  }
}

module.exports = {
  FileExistsOperation,
};
