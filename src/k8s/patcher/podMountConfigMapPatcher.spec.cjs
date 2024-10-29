const { PodMountConfigMapPatcher } = require('./podMountConfigMapPatcher.cjs');

describe('PodMountConfigMapPatcher', () => {

  var pod;

  beforeEach(() => {
    pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: 'my-pod',
      },
      spec: {
        containers: [
          {
            name: 'test',
          }
        ]
      }
    };
  });

  it('adds a configmap volume and volumeMount', () => {
    const patcher = new PodMountConfigMapPatcher('cm', 'vol');
    expect(patcher.mountPath).toEqual('/mnt');
    expect(patcher.configMapName).toEqual('cm');
    expect(patcher.volumeName).toEqual('vol');

    patcher.patch(pod);

    expect(pod.spec.containers[0].volumeMounts).toHaveLength(1);
    expect(pod.spec.containers[0].volumeMounts[0].name).toEqual(patcher.volumeName);
    expect(pod.spec.containers[0].volumeMounts[0].mountPath).toEqual(`${patcher.mountPath}/${patcher.volumeName}`);

    expect(pod.spec.volumes).toHaveLength(1);
    expect(pod.spec.volumes[0].name).toEqual(patcher.volumeName);
    expect(pod.spec.volumes[0].configMap).toBeDefined();
    expect(pod.spec.volumes[0].configMap.name).toEqual(patcher.configMapName);
    expect(pod.spec.volumes[0].configMap.defaultMode).toEqual(patcher.defaultMode);
  });

});
