
/**
 * @type {import("jest").Config}
 */
const config = {
  testTimeout: 300000,
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".spec.cjs",
}

module.exports = config;
