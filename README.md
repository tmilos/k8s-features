# K8S Features

A [Cucumber-js](https://github.com/cucumber/cucumber-js) base library for Kubernetes 
Gherkin tests, with base 
[world](https://github.com/cucumber/cucumber-js/blob/main/docs/support_files/world.md),
step helper and k8s utility functions, using 
[javascript kubernetes client](https://github.com/kubernetes-client/javascript).

## Getting started

Install the k8s-features library:

```bash
npm install -D k8s-features @cucumber/pretty-formatter
```

Write a feature file:

```bash
cat << EOF > features/test.feature
Feature: Test feature
  Scenario: Test scenario
    Given resources are watched:
      | Alias | Kind      | ApiVersion | Name            | Namespace  |
      | cm    | ConfigMap | v1         | `test-${id(4)}` |            |
    When ConfigMap cm is applied
    Then eventually "cm.data.foo == 'bar'" is ok 
EOF
```

Write a support step:

```bash
cat << EOF > src/myStep.cjs
const { When } = require('@cucumber/cucumber');

When('ConfigMap cm is applied', async function(alias) {
  const manifest = `
apiVersion: v1
Kind: ConfigMap
data:
  foo: bar
`;
  await this.applyWatchedManifest(alias, manifest);
});

EOF
```

Create the cucumber-js [profile](https://github.com/cucumber/cucumber-js/blob/main/docs/profiles.md):

```bash
cat << EOF > cucumber.mjs
import { DEFAULT_THEME } from '@cucumber/pretty-formatter';

export default function() {
  return {
    default: {
      {
        paths: [
          './features/**/*.feature',
        ],
        require: [
          './node_modules/k8s-features/steps.cjs',
        ],
        require: [
          './src/**/*.cjs',
        ],
        forceExit: true,
        publish: false,
        formatOptions: {
          colorsEnabled: true,
          theme: {
            ...DEFAULT_THEME,
          },
        },
      },
    },
  },
}
EOF
```

Verify which kubeconfig and context you're using.

```bash
export KUBECONFIG=/path/to/cluster/kubeconfig
```

Run the cucumber-js:

```bash
npx cucumber-js
```


## Expression evaluation

The lib uses [safe-eval](https://www.npmjs.com/package/safe-eval) for expression
evaluation. The expressions can be specified in the steps or resource declaration. Be
aware of the vulnerabilities that lib brings. Having in mind that internal stuff
will be writing resposibly test features and expressions being evaluated, and that 
also jailbreaking the sandbox would reach just your test suite w/out any critical exploits
you will be ok. Otherwise, take appropriate measutes to secure yourself. 

### Evaluation context

In the javascript sandbox used for expression evaluation following globals are set:
* all watched/declared resources by their Alias name
* namespace - the namespace world param, defaults to `default` if not specified
* id() - a function that generates random string
* findCondition() - a function that returns condition of specified type for the given object
* findConditionTrue() - a function that returns condition with status 'True' of specified type for the given object
* hasFinalizer() - a function that returns boolean if given object has specified finalizer


## Steps

### Given resources are watched

```gherkin
  Given resources are watched:
    | Alias | Kind      | ApiVersion | Name            | Namespace   |
    | cm    | ConfigMap | v1         | `test-${id(4)}` | `namespace` |

  Given resource declaration:
    | Alias | Kind      | ApiVersion | Name            | Namespace |
    | cm    | ConfigMap | v1         | `test-${id(4)}` |           |
```

Declares alias, kind, apiVersion, name and optional namespace of the resources that will be 
watched. At the moment of this step execution, the declared resource must exist in the cluster,
otherwise the watch will throw error and test will fail. The alias under which a resource is 
declared can be used in expressions. Since it will be watched, the resource's freshest possible
copy will be available in the local cache. If the resource by the declated name does not exist,
it's value in expressions will be `undefined`.

The data table must have columns Alias, Kind, ApiVersion, Name, Namespace. All are required, must have content,
except the Namespace column. If it's empty and the resource is namespace scope, then it will get the world 
parameter `namespace` value, or by default the `default` value. 

For Name and Namespace columns the expressions can be used, that are evaluated once at the moment of the step
execution. If an undefined value from the context is used in the expression, like for example a resource 
that does not exist yet, the error will be thrown and test will fail. 

### When resource X is applied

```gherkin
  When resource X is applied:
    """
    apiVersion: v1
    kind: ConfigMap
    data:
      foo: bar
    """
```

Executes the server side apply with the given yaml manifest on the watched resource X. The apiVersion, kind,
name and namespace are optional, and if ommitted they will be taken from the resource declaration. 

### Then "expression" is ok

```gherkin
  Then "cm.data.foo == 'bar'" is true 
```

Evalutes the expression and passes if value is truthy.

### Then eventually "expression" is ok 

```gherkin
  Then eventually "pod.status.phase == 'Succeeded'" is ok
```

Keeps evaluating the expression in the loop until it's value becomes truthy when it pass.

### Then eventually "expression" is ok, unless

```gherkin
  Then eventually "pod.status.phase == 'Succeeded'" is ok, unless:
    | pod.status.phase == 'Failed' '
```

Keeps evaluating the expression in the loop until it's value becomes truthy when it pass, 
or until any of the unless expressions becomes truthy when it fails. 


### When resource X is deleted

```gherkin
  When resource cm is deleted
```

Calls the K8S delete API on the specified watched/declared resource. 

### Then resource X does not exist

```gherkin
  Then resource cm does not exist
```

Passes if the specified watched/declated resource does not exist, ie
was deleted.


### Then eventually resource X does not exist

```gherkin
  Then eventually resource cm does not exist
```

Loops until the specified watched/declated resource does not exist.


### Then PVC X file operations succeed

```gherkin
  Then PVC x file operations succeed:
    | Operation | Path    | Content      |
    | Create    | foo.txt | some content |
    | Append    | foo.txt | some more    |
    | Delete    | foo.txt |              |
    | Contains  | foo.txt | content      |
    | Exists    | foo.txt |              |
```

Runs a pod with specified watched/declated PersistentVolumeClaim
as mount and executes given file operations on it. If any of the operations
fail, the step will throw error and the test will fail. 


### Then redis CMD gives OUTPUT

```gherkin
  Then Redis "PING" gives "PONG" with:
    | Host    | Secret | `redis.metadata.name` | host       |
    | Port    | Secret | `redis.metadata.name` | port       |
    | Auth    | Secret | `redis.metadata.name` | authString |
    | TLS     | True   |                       |            |
    | CA      | Secret | `redis.metadata.name` | CaCert.pem |
    | Version | 7.4    |                       |            |
```

Runs a pod with redis-cli executable with specified command and connection
parameters. The Host parameter is mandaroty, and others are optional. The
Version defines the [Redis container image](https://hub.docker.com/_/redis) tag
to use, and if not specified it defaults to `latest`.

If expected output is found in the pod logs, the step will pass, 
otherwise it will throw error and the test will fail. 


## Framework

Since this lib brings just the basic steps, it allows you to write your own
by using it's underlaying framework. 

### World

The cucumber-js world has these methods that you can use from your custom step:

#### async addWatchedResources(...resources: IResourceDeclaration): Promise<void>

Adds watched/declated resources. Called by the step 
[Given resources are watched](#given-resources-are-watched).
The argument type `IResourceDeclaration` has fields:
* alias: string
* kind: string
* apiVersion: string
* name: string
* namespace: string|undefined


#### getItem(alias: string): ResourceDeclaration | undefined

Returns an item for the given alias. The return type `ResourceDeclaration` has fields:
* alias: string
* kind: string
* apiVersion: string
* name: string
* namespace: string | undefined
* resource: [V1APIResource](https://kubernetes-client.github.io/javascript/classes/V1APIResource.html)


#### getObj(alias: string): KubernetesObject | undefined

Returns K8S object for the given alias. The [KubernetesObject](https://github.com/kubernetes-client/javascript/blob/0.22.0/src/types.ts#L3) type is from `@kubernetes/client-node` lib.


#### template(template: string): string

Evaluates given [javascript template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).


#### eval(expression: string): any

Evaluates the given javascript expression within the k8s-features [context](#evaluation-context).


#### async getAllResourcesFromApiVersion(apiVersion: string): Promise<V1APIResource[]>

Returns the list of defined resources for the given apiVersion. The return type 
[V1APIResource](https://kubernetes-client.github.io/javascript/classes/V1APIResource.html) is from the `@kubernetes/client-node` lib.


#### valueIsOk(expression: string): void

Evaluates the expression and throws if result is not truthy. Used by the 
[then expression is ok](#then-expression-is-ok) step.


#### async eventuallyValueIsOk(expression: string, ...unlessExpressions: string[]): Promise<void>

Keeps evaluating the given `expression` in the loop and resolves when it evaluates to truthy, or
rejects when any of the `unlessExpressions` evaluates to falsy.


#### async update(obj: KubernetesObject, item?: ResourceDeclaration): Promise<void>

Calls the K8S update API for the given object. If the optional argument `item` is provided
and if object has empty apiVersion, kind, name or namespace it will populate them from the
`item` argument. 


#### async applyObject(obj: KubernetesObject, item?: ResourceDeclaration): Promise<void>

Does a server side apply patch call to the K8S API for the given object. 
If the optional argument `item` is provided
and if object has empty apiVersion, kind, name or namespace it will populate them from the
`item` argument. If the optional argument `item` is provided, it will mark it as created by 
the lib and after all tests are done it will delete it. 


#### async applyYamlManifest(manifest: string, item?: ResourceDeclaration): Promise<void>

Parse the given yaml `manifest`, and calls the `applyObject()`. 


#### async applyWatchedManifest(alias: string, manifest: string): Promise<void>

Finds the watched item for the given `alias`, and calls `applyYamlManifest()`.


#### async delete(obj: KubernetesObject): Promise<void>

Calls the K8S delete API for the given object.


#### async eventuallyResourceDoesNotExist(alias: string): Promise<void>

Keeps checking the local cache in the loop until given `alias` does not exist
any more (ie was deleted by the server) and resolves. 


#### resourceDoesNotExist(alias: string)

Returns if given `alias` is undefined (ie deleted) in the local cache, or throws
if it exists.


#### async getLogs(podName, namespace, containerName, tailLines = 100): Promise<string>

Resolves with the logs for the specified container.


#### async createPod(name: string, namespace: string, scriptLines: string, image = 'ubuntu', ...patches: AbstractKubernetesObjectPatcher[]): Promise<{podObj: KubernetesObject, cmObj: KubernetesObject}>

Creates a pod with given name and namespace, bash script lines, and optional container image and patches.
The specified scriptLines are composed into a ConfigMap with a bash script key which is mounted to the pod
and given as the entry point. Starts watching of that Pod and ConfigMap and calls `applyObject()` so 
created Pod and ConfigMap will be deleted once the tests are finished.
Resolves to object with `podObj` and `cmObj` properties, both of the `KubernetesObject` type.


#### async pvcFileOperations(alias: string, ...fileOperations: AbstractFileOperation[]): Promise<void>

Finds watched PersistentVolumeClaim with specified `alias`, mapps specified `fileOperations` into
bash script lines, and calls `createPod()` with PVC as mounted volume. If Pod phase eventually
becomes `Failed` it rejects. When the Pod phase eventually becomes `Succeeded` if inspects the 
Pod logs with `getLogs()` if all file operations succeeded. Rejects if any failed, or 
if all file opreations have pass it deletes the created Pod and ConfigMap and resolves.


### Patchers

The `AbstractKubernetesObjectPatcher` defines an interface that receives a `KubernetesObject`
that it should patch - mutate to some desired state. 

#### PodEnvFixedPatcher

The `PodEnvFixedPatcher` mutates Pod with a fix environment variable value on the first container.

Constructor arguments:
* name: string - env var name
* value: string - env var value


#### PodEnvFromConfigMapPatcher

The `PodEnvFromConfigMapPatcher` mutates Pod with an environment variable with ConfigMap projection.

Constructor arguments:
* name: string - env var name
* configMapName: string
* key: string - ConfigMap key to project to the environment variable


#### PodEnvFromSecretPatcher

The `PodEnvFromSecretPatcher` mutates Pod with an environment variable with Secret projection.

Constructor arguments:
* name: string - env var name
* secretName: string
* key: string - Secret key to project to the environment variable


#### AbstractPodMountPatcher

The `AbstractPodMountPatcher` defines an abstract class that mutates given Pod with a volume
and volumeMount on first container.

#### PodMountConfigMapPatcher

The `PodMountConfigMapPatcher` mutates a Pod with ConfigMap volume and mount.

Constructor arguments:
* configMapName: string
* volumeName: string|undefined - defaults to configMapName
* mountPath: string|undefined - defaults to '/mnt'
* defaultMode: number|undefined - defaults to 0o644


#### PodMountPvcPatcher

The `PodMountPvcPatcher` mutates a Pod with PersistentVolumeClain volume and mount.

Constructor arguments:
* pvcName: string
* volumeName: string|undefined - defaults to pvcName
* mountPath: string|undefined - defaults to '/mnt'

#### PodMountSecretPatcher

The `PodMountSecretPatcher` mutates a Pod with Secret volume and mount.

Constructor arguments:
* secretName: string
* volumeName: string|undefined - defaults to secretName
* mountPath: string|undefined - defaults to '/mnt'



### File Operations

The `AbstractFileOperation` is an abstract class that produces bash script lines in the
context of the given `rootDir`, performing some kind of file operation, like create, delete...

#### CreateFileOperation

The `CreateFileOperation` creates a file with specified path and content.

Constructor arguments:
* path: string
* content: stirng


#### AppendFileOperation

The `AppendFileOperation` appends a file with with specified path and content.

Constructor arguments:
* path: string
* content: stirng

#### FileContainsOperation

The `FileContainsOperation` checks if a file with specified path contains specified content. 
If the content is not found it exits Pod script with non-zero code, and makes the Pod get the
`Failed` phase.

Constructor arguments:
* path: string
* content: stirng

#### FileExistsOperation

The `FileContainsOperation` checks if a file with specified path exists. 
If the file is not found it exits Pod script with non-zero code, and makes the Pod get the
`Failed` phase.

Constructor arguments:
* path: string

#### DeleteFileOperation

The `DeleteFileOperation` deletes a file on the specified path. 

Constructor arguments:
* path: string
