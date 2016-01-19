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
    model.settings = {};
    var storedSettings = {};
    var defaultSettings = {
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
        storedSettings = result.data.length === 1 ? result.data[0].value : {};
        // required so that angular extend does not link model.storedSettings
        // with model.settings
        var stored = angular.copy(storedSettings);
        var def = angular.copy(defaultSettings);
        angular.extend(model.settings, def, stored);
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
          storedSettings = angular.copy(model.settings);
          scope.$apply();
        });
    };

    model.cancel = function() {
      // stored settings might be an empty object
      var stored = angular.copy(storedSettings);
      var def = angular.copy(defaultSettings);
      angular.extend(model.settings, def, stored);
    };
  }
}

return {brPushNotification: factory};

});
