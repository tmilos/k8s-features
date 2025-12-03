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
      ``,
      `# FileContainsOperation`,
      `FILE=${rootDir}/${this.path}`,
      `DIR=${rootDir}`,
      `CONTENT="${this.content}"`,
      `echo "searching for $CONTENT in the file $FILE in $DIR"`,
      `echo "directory '$DIR' content:"`,
      `ls -la $DIR || echo 'ls err'`,
      `echo "file content:"`,
      `cat $FILE || echo 'cat err'`,
      `if ! grep "$CONTENT" "$FILE"; then`,
      `  echo "content '$CONTENT' not found"`,
      `  echo "directory '$DIR' content:"`,
      `  ls -la $DIR`,
      `  echo "file content:"`,
      `  cat $FILE`,
      `  exit 1`,
      `fi`,
      ``,
    ];
  }
}

module.exports = {
  FileContainsOperation,
};
