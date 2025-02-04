const { DataTable } = require('@cucumber/cucumber');
const { WatchedResources } = require('../support/resourceDeclaration.cjs');
const { MyWorld } = require('../support/world.cjs');
const { redisCmd } = require('../support/stepRedis.cjs');
const { createSandbox } = require('sinon');
const { PodEnvFromSecretPatcher } = require('../k8s/patcher/podEnvFromSecretPatcher.cjs');
const { logger } = require('../util/logger.cjs');

describe('step Redis cmd', function() {

  /**
   * @type {import("sinon").SinonSandbox}
   */
  let sandbox;

  /**
   * @type {import("sinon").SinonStubbedInstance<MyWorld>}
   */
  let worldStub;

  /**
   * @type {import("sinon").SinonStubbedInstance<WatchedResources>}
   */
  let watechedResourcesStub;

  const secretName = 'rediSecret';
  const secretNameExpression = 'redis.metadata.name';
  const secretNameTemplated = '`'+secretNameExpression+'`';

  const templateEvals = new Map([
    [secretNameTemplated, secretName],
  ]);

  beforeEach(() => {
    logger.silent = true;

    sandbox = createSandbox();
    watechedResourcesStub = sandbox.createStubInstance(WatchedResources);
    worldStub = sandbox.createStubInstance(MyWorld);
    worldStub.watchedResources = watechedResourcesStub;
    worldStub.parameters = {
      namespace: 'default',
    }

    watechedResourcesStub.add.resolves();
    watechedResourcesStub.startWatches.resolves();

    worldStub.templateWithThrow.callsFake(
      /**
       *
       * @param {string} template
       * @returns {string}
       */
      function(template) {
        if (template.startsWith("`") && template.endsWith("`")) {
          if (templateEvals.has(template)) {
            return templateEvals.get(template);
          }
          throw new Error(`Template "${template}" value is not defined in the test`);
        }
        return template;
      }
    );
    worldStub.createPod.callsFake(
      /**
       *
       * @param {string} name
       * @param {string} namespace
       * @param {string[]} scriptLines
       * @param {string} image
       * @param {...import("../k8s/patcher/types.cjs").AbstractKubernetesObjectPatcher} patches
       * @returns {Promise<{podObj: import("@kubernetes/client-node").KubernetesObject, cmObj: import("@kubernetes/client-node").KubernetesObject}>}
       */
      function(name, namespace) {
        return Promise.resolve({
          podObj: {
            metadata: {
              apiVersion: 'v1',
              kind: 'Pod',
              namespace,
              name,
            }
          },
          cmObj: {
            metadata: {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              namespace,
              name,
            }
          },
        })
      }
    );
    worldStub.eventuallyValueIsOk.resolves();
    worldStub.getLogs.resolves('PONG');
    worldStub.delete.resolves();
  });

  it('runs a pod', async function() {

    await redisCmd(worldStub, 'PING', 'PONG', new DataTable([
      ['Host', 'Secret', secretNameTemplated, 'host'],
      ['Port', 'Secret', secretNameTemplated, 'port'],
      ['Auth', 'Secret', secretNameTemplated, 'authString'],
      ['TLS', 'True', '', ''],
    ]));

    expect(worldStub.createPod.called).toBe(true);
    const scriptLines = worldStub.createPod.firstCall.args[2];
    /**
     * @type {PodEnvFromSecretPatcher[]}
     */
    const patches = worldStub.createPod.firstCall.args.slice(4);

    expect(scriptLines).toEqual([
      "apt-get update",
      "apt-get install -y ca-certificates",
      "update-ca-certificates",
      "redis-cli -h $HOST -p $PORT --tls PING",
    ]);

    expect(patches).toHaveLength(3);

    expect(patches[0]).toBeInstanceOf(PodEnvFromSecretPatcher);
    expect(patches[0].name).toBe('HOST');
    expect(patches[0].secretName).toBe(secretName);
    expect(patches[0].key).toBe('host');

    expect(patches[1]).toBeInstanceOf(PodEnvFromSecretPatcher);
    expect(patches[1].name).toBe('PORT');
    expect(patches[1].secretName).toBe(secretName);
    expect(patches[1].key).toBe('port');

    expect(patches[2]).toBeInstanceOf(PodEnvFromSecretPatcher);
    expect(patches[2].name).toBe('REDISCLI_AUTH');
    expect(patches[2].secretName).toBe(secretName);
    expect(patches[2].key).toBe('authString');
  });

});
