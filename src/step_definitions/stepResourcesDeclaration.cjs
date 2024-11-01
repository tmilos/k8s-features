const { Given, DataTable } = require('@cucumber/cucumber');
const { MyWorld } = require('../support/world.cjs');
const { resourceDeclaration } = require('../support/stepResourceDeclaration.cjs');

/*
Given resource declaration:
  | Alias | Kind                      | ApiVersion              | Name                                 | Namespace  |
  | crd   | customresourcedefinitions | apiextensions.k8s.io/v1 | destinationrules.networking.istio.io | $namespace |
  | cm    | ConfigMap                 | v1                      | `test-${id(4)}`                      | `namespace` |
*/

Given(
  'resource declaration:', 
  /**
   * @this MyWorld
   * @param {DataTable} table
   * @returns {Promise}
   */
  async function(table) {
    await resourceDeclaration(this, table);
  }
);

/*
Given resources are watched:
  | Alias | Kind                      | ApiVersion              | Name                                 | Namespace  |
  | crd   | customresourcedefinitions | apiextensions.k8s.io/v1 | destinationrules.networking.istio.io | $namespace |
  | cm    | ConfigMap                 | v1                      | `test-${id(4)}`                      | `namespace` |
*/

Given(
  'resources are watched:', 
  /**
   * @this MyWorld
   * @param {DataTable} table
   * @returns {Promise}
   */
  async function(table) {
    await resourceDeclaration(this, table);
  }
);
