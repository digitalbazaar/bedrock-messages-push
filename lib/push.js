/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

// var async = require('async');
var bedrock = require('bedrock');
// var BedrockError = bedrock.util.BedrockError;
// var brPassport = require('bedrock-passport');
var config = bedrock.config;
var database = require('bedrock-mongodb');
// var ensureAuthenticated = brPassport.ensureAuthenticated;
// var rest = require('bedrock-rest');
// var uuid = require('node-uuid').v4;
// var validate = require('bedrock-validation').validate;
// var store = null;
// var storeInvalid = null;
// require('bedrock-express');

require('./config');

// configure for tests
bedrock.events.on('bedrock.test.configure', function() {
  require('./test.config');
});
