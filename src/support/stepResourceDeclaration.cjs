
/**
 * @param {import('./world.cjs').MyWorld} world 
 * @param {import('@cucumber/cucumber').DataTable} table 
 */
async function resourceDeclaration(world, table) {
  const raw = table.raw();
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Resources must be declated with a table having headers: Alias, Plural, ApiVersion, Name, Namespace');
  }
  /**
   * @type {import('../support/world.cjs').IResourceDeclaration[]}
   */
  let resources = [];
  for (let row of table.hashes()) {
    resources.push({
      alias: row.Alias,
      kind: row.Kind,
      apiVersion: row.ApiVersion,
      name: world.template(row.Name),
      namespace: world.template(row.Namespace),
    });
  }
  await world.addWatchedResources(...resources);
}

module.exports = {
  resourceDeclaration,
};
