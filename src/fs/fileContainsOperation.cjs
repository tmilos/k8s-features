const { AbstractFileOperation } = require('./fileOperation.cjs');

class FileContainsOperation extends AbstractFileOperation {
  /**
   * 
   * @param {string} path 
   * @param {string} content 
   */
  constructor(path, content) {
    super(path);
    this.content = content;
  }

  /**
   * 
   * @param {string} rootDir 
   * @returns {string[]}
   */
  bash(rootDir) {
    return [
      `grep "${this.content}" ${rootDir}/${this.path} > /dev/null || (echo "not found: ${this.content}"; exit 1)`,
    ];
  }
}

module.exports = {
  FileContainsOperation,
};
