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
    model.settings = {
      email: false
    };

    brNotificationService.get(scope.userId)
      .then(function(result) {
        var options = result.data.length === 1 ? result.data[0].value : {};
        model.settings.email = options.email || false;
        model.loading = false;
        scope.$apply();
      });

    model.update = function() {
      model.loading = true;
      var options = {
        id: scope.userId,
        email: model.settings.email
      };
      brNotificationService.update(options)
        .then(function(result) {
          model.loading = false;
          scope.$apply();
          // display a success?
        });
    };

    model.cancel = function() {

    };
  }
}

return {brPushNotification: factory};

});
