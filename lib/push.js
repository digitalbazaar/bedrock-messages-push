/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

var async = require('async');
var bedrock = require('bedrock');
// var BedrockError = bedrock.util.BedrockError;
var brPassport = require('bedrock-passport');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var ensureAuthenticated = brPassport.ensureAuthenticated;
var rest = require('bedrock-rest');
// var uuid = require('node-uuid').v4;
// var validate = require('bedrock-validation').validate;
var store = null;
var userSettings = null;
// var storeInvalid = null;
// require('bedrock-express');

// load config
require('./config');

// configure for tests
bedrock.events.on('bedrock.test.configure', function() {
  require('./test.config');
});

var logger = bedrock.loggers.get('app');

// create the collection to store messages
bedrock.events.on('bedrock-mongodb.ready', function(callback) {
  logger.debug('Creating messages collection.');
  async.auto({
    openCollections: function(callback) {
      database.openCollections([
        'messagesPush', 'messagesPushUserSettings'
      ], function(err) {
        if(!err) {
          store = database.collections.messagesPush;
          userSettings = database.collections.messagesPushUserSettings;
        }
        callback(err);
      });
    },
    createIndexes: ['openCollections', function(callback) {
      database.createIndexes([{
        collection: 'messagesPush',
        fields: {'value.interval': 1, 'value.method': 1},
        options: {unique: false, background: false}
      }, {
        collection: 'messagesPushUserSettings',
        fields: {id: 1},
        options: {unique: true, background: false}
      }], callback);
    }]
  }, function(err) {
    callback(err);
  });
});

// add routes
bedrock.events.on('bedrock-express.configure.routes', function(app) {
  // FIXME: what is the permissions model for this?
  app.get(
    config['messages-push'].endpoints.settings + '/:id', rest.when.prefers.ld,
    ensureAuthenticated, function(req, res, next) {
      getId(req.params.id, function(err, results) {
        // FIXME: address error conditions
        res.json(results);
      });
    });

  app.post(
    config['messages-push'].endpoints.settings + '/:id', rest.when.prefers.ld,
    ensureAuthenticated, function(req, res, next) {
      update(req.body, function(err, results) {
        // FIXME: address error conditions
        res.json(results);
      });
    });
});

function getId(id, callback) {
  var query = {
    id: database.hash(id)
  };
  userSettings.find(query).toArray(callback);
}

function update(options, callback) {
  var query = {
    id: database.hash(options.id)
  };
  var updates = {
    $set: {
      id: database.hash(options.id),
      'value.email': options.email,
      'value.sms': options.sms
    }
  };
  userSettings.update(query, updates, {upsert: true}, callback);
}
