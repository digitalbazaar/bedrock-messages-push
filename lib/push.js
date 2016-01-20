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
var uuid = require('node-uuid').v4;
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

var api = {};
module.exports = api;

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
      updateSettings(req.body, function(err, results) {
        // FIXME: address error conditions and response
        res.json(results);
      });
    });
});

api.queue = function(message, callback) {
  // determine if recipient has any notification settings
  // add message to the queue based on those preferences
  async.auto({
    getSettings: function(callback) {
      getId(message.recipient, callback);
    },
    queue: ['getSettings', function(callback, results) {
      if(results.getSettings.length === 0) {
        // user has not setup any message push settings
        return callback();
      }
      async.forEachOf(
        results.getSettings[0].value, function(notifyMethod, key, callback) {
          var jobId = uuid();
          if(!notifyMethod.enable) {
            return callback();
          }
          var messageData = {};
          messageData[database.hash(message.id)] = true;
          async.auto({
            lock: function(callback) {
              var query = {
                id: database.hash(message.recipient),
                'value.method': key,
                'value.interval': notifyMethod.interval,
                $or: [
                  {'meta.locked': {$exists: false}},
                  {'meta.locked.expires': {$lte: Date.now()}}
                ]
              };
              var update = {
                $set: {
                  'meta.lock': {id: jobId, expires: Date.now() + 5000}
                }
              };
              store.update(query, update, {}, callback);
            },
            insert: ['lock', function(callback, results) {
              if(results.lock.result.nModified > 0) {
                return callback();
              }
              var value = {
                id: database.hash(message.recipient),
                'value': {
                  method: key,
                  interval: notifyMethod.interval,
                  messages: [database.hash(message.id)]
                }
              };
              store.insert(value, database.writeOptions, callback);
            }],
            update: ['lock', function(callback, results) {
              if(results.lock.result.nModified === 0) {
                return callback();
              }
              var query = {
                'meta.lock.id': jobId
              };
              var u = {
                $push: {'value.messages': database.hash(message.id)},
                $unset: {'meta.lock': ''}
              };
              store.update(query, u, {}, callback);
            }]
          }, callback);
        });
    }]
  }, callback);
};

function getId(id, callback) {
  var query = {
    id: database.hash(id)
  };
  userSettings.find(query).toArray(callback);
}

function updateSettings(options, callback) {
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
