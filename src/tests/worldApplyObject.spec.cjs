const { MyWorld } = require('../support/world.cjs');
const { logger } = require('../util/logger.cjs');
const { makeid } = require('../util/makeId.cjs');

describe('world.applyObject', function() {

  const namespace = 'k8s-features';
  const itemName = 'cm';

  /** @type {MyWorld} */
  let world;

  beforeAll(async () => {
    logger.silent = true;

    world = new MyWorld({});
    await world.init();
  });

  afterAll(async () => {
    if (world) {
      await world.stopWatches();
    }
  });

  it('can create a valid ConfigMap as watched resource', async () => {
    await world.addWatchedResources({
      alias: itemName,
      kind: 'ConfigMap',
      apiVersion: 'v1',
      name: itemName+'-'+makeid(),
      namespace,
    });

    await world.applyWatchedManifest(
      'cm',
      `apiVersion: v1
kind: ConfigMap
data:
  foo: bar`
    );

    await world.watchedResources.startWatches();

    const obj = world.getObj(itemName);
    expect(obj).toBeDefined();
  });


  it('fails creating invalid Pod', () => {
    return expect(world.applyYamlManifest(`
apiVersion: v1
kind: Pod
metadata:
  name: pod-${makeid()}
  namespace: ${namespace}
spec:
  containers:
    - name: a/b
      image: busybox
      command:
        - "/bin/ash"
        - "-c"
        - "--"
      args:
        - "echo 'foo'"
      `)
    ).rejects.toThrow(/a lowercase RFC 1123 label must consist of lower case alphanumeric characters/);
  });
});
