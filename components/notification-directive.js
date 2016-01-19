/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

/* @ngInject */
function factory(brNotificationService, config) {
  return {
    restrict: 'E',
    scope: {
      userId: '=brUserId'
    },
    templateUrl: requirejs.toUrl(
      'bedrock-messages-push/components/notification-directive.html'),
    link: Link
  };

  function Link(scope) {
    var model = scope.model = {};
    model.loading = true;
    model.methods = config.data['bedrock-messages-push'].methods;
    model.storedSettings = {};
    model.settings = {};
    model.defaultSettings = {
      email: {
        enable: false,
        interval: 'daily'
      },
      sms: {
        enable: false,
        interval: 'immediate'
      }
    };

    brNotificationService.get(scope.userId)
      .then(function(result) {
        model.storedSettings =
          result.data.length === 1 ? result.data[0].value : {};
        // required so that angular extend does not link model.storedSettings
        // with model.settings
        var storedSettings = angular.copy(model.storedSettings);
        var defaultSettings = angular.copy(model.defaultSettings);
        angular.extend(model.settings, defaultSettings, storedSettings);
        model.loading = false;
        scope.$apply();
      });

    model.update = function() {
      model.loading = true;
      var options = {
        id: scope.userId,
        email: model.settings.email,
        sms: model.settings.sms
      };
      brNotificationService.update(options)
        .then(function(result) {
          model.loading = false;
          model.storedSettings = angular.copy(model.settings);
          scope.$apply();
        });
    };

    model.cancel = function() {
      // stored settings might be an empty object
      var storedSettings = angular.copy(model.storedSettings);
      var defaultSettings = angular.copy(model.defaultSettings);
      angular.extend(model.settings, defaultSettings, storedSettings);
    };
  }
}

return {brPushNotification: factory};

});
