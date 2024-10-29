const { DataTable, Then } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');

/*
  Then "cm.data.foo == 'bar'" is true 
*/
Then(
  '{string} is ok', 
  /**
   * @this MyWorld
   * @param {string} actualExp 
   */
  function(actualExp) {
    this.valueIsOk(actualExp);
  }
);


/*
 Cucumbers-js does not support optional DataTable. It finds that function argument
 and think it's a done callback.
       Error: function uses multiple asynchronous interfaces: callback and promise
       to use the callback interface: do not return a promise
       to use the promise interface: remove the last argument to the function
*/

/*
  Then eventually "cm.data.foo == 'bar'" is ok
*/
Then(
  'eventually {string} is ok',
  /**
   * @this MyWorld
   * @param {string} actualExp
   * @returns {Promise}
   */
  async function(actualExp) {
    await this.eventuallyValueIsOk(actualExp);
  }
);

/*
  Then eventually "cm.data.foo == 'bar'" is ok, unless:
    | cm.data.foo && cm.data.foo != 'bar' |
*/
Then(
  'eventually {string} is ok, unless:',
  /**
   * @this MyWorld
   * @param {string} actualExp 
   * @param {DataTable} unlessTable
   * @returns {Promise}
   */
  async function(actualExp, unlessTable) {
    /**
     * @type {string[]}
     */
    let unlessExp = unlessTable.raw().map(row => row[0]);
    await this.eventuallyValueIsOk(actualExp, ...unlessExp);
  }
);
