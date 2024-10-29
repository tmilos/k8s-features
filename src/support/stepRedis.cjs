const { DataTable } = require('@cucumber/cucumber');
const { MyWorld } = require('./world.cjs');
const { AbstractKubernetesObjectPatcher } = require('../k8s/patcher/types.cjs');
const { PodEnvFromSecretPatcher } = require('../k8s/patcher/podEnvFromSecretPatcher.cjs');
const { PodEnvFromConfigMapPatcher } = require('../k8s/patcher/podEnvFromConfigMapPatcher.cjs');
const { PodEnvFixedPatcher } = require('../k8s/patcher/podEnvFixedPatcher.cjs');
const { makeid } = require('../util/makeId.cjs');
const { PodMountSecretPatcher } = require('../k8s/patcher/podMountSecretPatcher.cjs');
const { PodMountConfigMapPatcher } = require('../k8s/patcher/podMountConfigMapPatcher.cjs');

class RedisCmdGivenParams {
  host = false;
  port = false;
  auth = false;
  tls = false;
  ca = '';
  version = '';
}

/**
 * @param {string} rowName 
 * @param {string[]} row 
 * @param {number} index 
 * @param {string} colName 
 */
function mustHaveColumn(rowName, row, index, colName) {
  if (row.length < index - 1) {
    throw new Error(`Redis table for ${rowName} missing column ${index} as ${colName}`);
  }
  const val = row[index];
  if (!val) {
    throw new Error(`Redis table for ${rowName} has emprty column ${index} as ${colName}`);
  }
}

/**
 * @param {MyWorld} world 
 * @param {string} envVarName 
 * @param {string[]} row 
 * @returns {AbstractKubernetesObjectPatcher}
 */
function envPatcherForParam(world, envVarName, row) {
  const valueIndicator = world.template(row[1]);
  switch (valueIndicator) {
    case 'Secret':
      mustHaveColumn(envVarName, row, 2, 'secret name');
      mustHaveColumn(envVarName, row, 3, 'secret key');
      return new PodEnvFromSecretPatcher(envVarName, world.template(row[2]), world.template(row[3]));
    case 'ConfigMap':
      mustHaveColumn(envVarName, row, 2, 'configmap name');
      mustHaveColumn(envVarName, row, 3, 'configmap key');
      return new PodEnvFromConfigMapPatcher(envVarName, world.template(row[2]), world.template(row[3]));
    default:
      return new PodEnvFixedPatcher(envVarName, valueIndicator);
  }
}

/**
 * @typedef VolumePatcherForParamResult
 * @property {KubernetesObjectPatcher} patcher
 * @property {string} key
 */

/**
 * @param {MyWorld} world 
 * @param {string} rowName 
 * @param {string[]} row 
 * @param {string} volumeName 
 * @returns {VolumePatcherForParamResult}
 */
function volumePatcherForParam(world, rowName, row, volumeName) {
  const valueIndicator = world.template(row[1]);
  switch (valueIndicator) {
    case 'Secret':
      mustHaveColumn(rowName, row, 2, 'secret name');
      mustHaveColumn(rowName, row, 3, 'secret key');
      return {
        patcher: new PodMountSecretPatcher(row[2], volumeName),
        key: row[3],
      }
    case 'ConfigMap':
      mustHaveColumn(rowName, row, 2, 'configmap name');
      mustHaveColumn(rowName, row, 3, 'configmap key');
      return {
        patcher: new PodMountConfigMapPatcher(row[2], volumeName),
        key: row[3],
      }
    default:
      throw new Error(`The Redis param ${rowName} must be specified in secret or configmap`);
  }
}

/**
 * @param {MyWorld} world 
 * @param {string} cmd 
 * @param {string} expectedOutput 
 * @param {DataTable} dataTable 
 * @returns {Promise}
 */
async function redisCmd(world, cmd, expectedOutput, dataTable) {
  /**
   * @type {KubernetesObjectPatcher[]}
   */
  const patchers = [];

  const setValues = new RedisCmdGivenParams();

  for (let row of dataTable.raw()) {
    switch (row[0]) {
      case 'Host':
        setValues.host = true;
        patchers.push(envPatcherForParam(world, 'HOST', row));
        break;
      case 'Port':
        setValues.port = true;
        patchers.push(envPatcherForParam(world, 'PORT', row));
        break;
      case 'Auth':
        setValues.auth = true;
        patchers.push(envPatcherForParam(world, 'REDISCLI_AUTH', row));
      case 'TLS':
        mustHaveColumn('TLS', row, 1, 'tls enabled');
        setValues.tls = ['true', 'yes', 'on', '1'].includes(world.template(row[1]).toLocaleLowerCase());
        break;
      case 'CA':
        const patch = volumePatcherForParam(world, 'CA', row, 'cacert');
        setValues.ca = patch.key;
        patchers.push(patch.patcher);
        break;
      case 'Version':
        mustHaveColumn('Version', row, 1, 'version');
        setValues.version = world.template(row[1]);
      default:
        throw new Error(`Unknown Redis parameter ${row[0]}`);
    }
  }

  if (!setValues.host) {
    throw new Error(`Mandatory Redis Host param is not set`);
  }

  const name = `k8f${makeid(8)}`;
  const namespace = world.parameters.namespace ?? 'default';

  /**
   * @type {string[]}
   */
  const scriptLines = [];
  if (setValues.tls && setValues.ca == '') {
    scriptLines.push(
      `apt-get update`,
      `apt-get install -y ca-certificates`,
      `update-ca-certificates`,
    )
  }
  let command = `redis-cli -h $HOST`;
  if (setValues.port) {
    command += ` -p $PORT`;
  }
  if (setValues.tls) {
    command += ` --tls`;
  }
  if (setValues.ca != '') {
    command += `--cacert /mnt/cacert/${setValues.ca}`;
  }
  command += ` ${cmd}`;
  scriptLines.push(command);

  if (setValues.version == '') {
    setValues.version = 'latest';
  }

  await world.addWatchedResources({
    alias: name,
    kind: 'Pod',
    apiVersion: 'v1',
    name,
    namespace,
  })

  const { podObj, cmObj } = await world.createPod(name, namespace, scriptLines, `redis:${setValues.version}`, ...patchers);

  await world.eventuallyValueIsOk(
    `${name}.status.phase == "Succeeded"`, 
    `${name}.status.phase == "Failed"`
  );

  const logs = await world.getLogs(name, namespace, name);

  await world.delete(podObj);
  await world.delete(cmObj);

  if (logs.includes(expectedOutput)) {
    return;
  }

  throw new Error(`Redis command ${cmd} failed: ${"\n"+logs}`);
}

module.exports = {
  redisCmd,
};
