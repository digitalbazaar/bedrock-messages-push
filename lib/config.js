/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */

var config = require('bedrock').config;
var path = require('path');

config['messages-push'] = {};
// TODO: determine proper endpoint.  This could be /messages/settings
config['messages-push'].endpoints = {
  settings: '/push-settings'
};

// config views
config.views.vars['bedrock-messages-push'] = {};
config.views.vars['bedrock-messages-push'].endpoints =
  config['messages-push'].endpoints;
// FIXME: methods could be added here by the various modules
config.views.vars['bedrock-messages-push'].methods = {
  email: {
    enable: true
  },
  sms: {
    enable: false
  }
};
