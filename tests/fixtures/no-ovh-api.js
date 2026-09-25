/**
 * Preloaded (node --require) into the import scripts spawned by the tests:
 * the OVH API client cannot be loaded, so no test can reach the real API,
 * even on a machine whose config.json holds real credentials.
 */

const Module = require('module');

const load = Module._load;
Module._load = function (request, ...args) {
  if (request === 'ovh') {
    throw new Error('The OVH API client is disabled in tests');
  }
  return load.call(this, request, ...args);
};
