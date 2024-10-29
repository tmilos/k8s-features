const { DataTable, Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');
const { AbstractFileOperation } = require('../fs/fileOperation.cjs');
const { CreateFileOperation } = require('../fs/createFileOperation.cjs');
const { AppendFileOperation } = require('../fs/appendFileOperation.cjs');
const { DeleteFileOperation } = require('../fs/deleteFileOperation.cjs');
const { FileContainsOperation } = require('../fs/fileContainsOperation.cjs');
const { FileExistsOperation } = require('../fs/fileExistsOperation.cjs');


/*
    PVC x file operations succeed:
      | Operation | Path    | Content      |
      | Create    | foo.txt | some content |
      | Append    | foo.txt | some more    |
      | Delete    | foo.txt |              |
      | Contains  | foo.txt | content      |
      | Exists    | foo.txt |              |
*/
Then(
  'PVC {word} file operations succeed:', 
  /**
   * @this MyWorld
   * @param {string} alias 
   * @param {DataTable} table 
   * @returns {Promise}
   */
  async function(alias, table) {
    /**
     * 
     * @param {string} prop 
     * @param {Object.<string, string>} row 
     */
    const mustHaveProp = (prop, row) => {
      if (!(prop in row) || !row[prop]) {
        throw new Error(`Missing or empty ${prop} column in file operationbs table`);
      }
    }
    /**
     * @type {AbstractFileOperation[]}
     */
    const fileOperations = table.hashes().map((row) => {
      mustHaveProp('Operation', row);
      mustHaveProp('Path', row);
      switch (row.Operation) {
        case 'Create': {
          mustHaveProp('Content', row);
          return new CreateFileOperation(row.Path, row.Content);
        }
        case 'Append': {
          mustHaveProp('Content', row);
          return new AppendFileOperation(row.Path, row.Content);
        }
        case 'Delete': {
          return new DeleteFileOperation(row.Path);
        }
        case 'Contains': {
          mustHaveProp('Content', row);
          return new FileContainsOperation(row.Path, row.Content);
        }
        case 'Exists': {
          return new FileExistsOperation(row.Path);
        }
        default: {
          throw new Error(`Unknown file operation: ${row.Operation}`)
        }
      }
    })

    await this.pvcFileOperations(alias, ...fileOperations);
  }
);
