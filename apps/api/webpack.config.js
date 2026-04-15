/**
 * Custom webpack configuration for the NestJS API.
 *
 * Two problems solved here:
 *
 * 1. Native Node.js modules (bcrypt, sharp, etc.) use node-pre-gyp for binary
 *    bindings. Webpack cannot bundle these correctly, so they are marked as
 *    externals and left as plain `require()` calls resolved at runtime.
 *
 * 2. Prisma Client uses a native query engine (.dll.node on Windows, .so.node
 *    on Linux). When webpack bundles @prisma/client the engine binary path
 *    resolution breaks because the engine is looked up relative to the source
 *    file location — which no longer exists after bundling.
 *
 *    Fix: externalize both @prisma/client and .prisma/client so webpack emits
 *    `require('@prisma/client')` in the bundle. Node then resolves the package
 *    from node_modules at runtime where the engine binary already lives.
 */

const nativeModules = [
  'bcrypt',
  'sharp',
  'pdfkit',
  '@mapbox/node-pre-gyp',
  'mock-aws-s3',
  'aws-sdk',
  'nock',
];

// Runtime modules that webpack must not bundle — resolved by Node at runtime
const runtimeModules = [
  'express',
  'reflect-metadata',
  'rxjs',
  'class-transformer',
  'class-validator',
];

module.exports = function (options) {
  return {
    ...options,
    externals: [
      ...(Array.isArray(options.externals) ? options.externals : []),

      // Prisma: must NOT be bundled — engine binary is resolved from node_modules at runtime
      { '@prisma/client': 'commonjs @prisma/client' },
      { '.prisma/client': 'commonjs .prisma/client' },

      // Native addon modules + runtime modules (must not be bundled)
      function ({ request }, callback) {
        if (
          nativeModules.some((m) => request === m || request.startsWith(m + '/')) ||
          runtimeModules.some((m) => request === m || request.startsWith(m + '/'))
        ) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      },
    ],
  };
};
