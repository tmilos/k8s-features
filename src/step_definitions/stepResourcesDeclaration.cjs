const { Given } = require('@cucumber/cucumber');
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
   * @this import("../support/world.cjs").MyWorld
   * @param {import("@cucumber/cucumber").DataTable} table
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
   * @this import("../support/world.cjs").MyWorld
   * @param {import("@cucumber/cucumber").DataTable} table
   * @returns {Promise}
   */
  async function(table) {
    await resourceDeclaration(this, table);
  }
);
