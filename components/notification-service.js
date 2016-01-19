/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

/* @ngInject */
function factory($http, config) {
  var service = {};
  var settingsEndpoint =
    config.data['bedrock-messages-push'].endpoints.settings;

  service.get = function(id) {
    return Promise.resolve(
      $http({method: 'GET', url: settingsEndpoint + '/' + id}));
  };

  service.update = function(options) {
    return Promise.resolve(
      $http({
        method: 'POST',
        url: settingsEndpoint + '/' + options.id,
        data: options
      }));
  };

  return service;
}

return {brNotificationService: factory};

});
