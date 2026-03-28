/**
 * Custom webpack configuration for the NestJS API.
 *
 * Problem: Native Node.js modules (bcrypt, sharp, etc.) use node-pre-gyp for
 * binary bindings. Webpack cannot bundle these correctly and produces errors
 * about HTML files and missing aws-sdk/mock-aws-s3/nock modules.
 *
 * Solution: Mark native modules as externals so webpack leaves them as
 * `require('module-name')` calls that Node resolves at runtime from
 * node_modules — exactly how they're meant to be used.
 */

const nativeModules = [
  'bcrypt',
  'sharp',
  '@mapbox/node-pre-gyp',
  'mock-aws-s3',
  'aws-sdk',
  'nock',
];

module.exports = function (options) {
  return {
    ...options,
    externals: [
      ...(Array.isArray(options.externals) ? options.externals : []),
      function ({ request }, callback) {
        if (nativeModules.some((m) => request === m || request.startsWith(m + '/'))) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      },
    ],
  };
};
