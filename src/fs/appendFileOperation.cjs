const { AbstractFileOperation } = require("./fileOperation.cjs");

class AppendFileOperation extends AbstractFileOperation {
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
      `echo "${this.content}" >> ${rootDir}/${this.path}`,
    ];
  }
}

module.exports = {
  AppendFileOperation,
};
