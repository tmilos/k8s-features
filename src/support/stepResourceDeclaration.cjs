
/**
 * @param {import('./world.cjs').MyWorld} world 
 * @param {import('@cucumber/cucumber').DataTable} table 
 */
async function resourceDeclaration(world, table) {
  const raw = table.raw();
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Resources must be declared with a table having headers: Alias, Kind, ApiVersion, Name, Namespace');
  }
  /**
   * @type {import('../support/world.cjs').IResourceDeclaration[]}
   */
  let resources = [];
  for (let row of table.hashes()) {
    const res = {
      alias: row.Alias,
      kind: row.Kind,
      apiVersion: row.ApiVersion,
      name: row.Name,
      namespace: row.Namespace,
    };
    resources.push(res);
    // must add one by one, so the previously added rows are available for expression
    // evaluation of the next ones
    await world.addWatchedResources(res);
  }
  console.log('Added resources:')
  for (let res of resources) {
    const item = world.getItem(res.alias);
    console.log(`  ${item.alias}  ${item.kind}  ${item.apiVersion}  ${item.name}  ${item.namespace}`);
  }
}

module.exports = {
  resourceDeclaration,
};
