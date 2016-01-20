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
api.queue = {};
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
        collection: 'messagesPush',
        fields: {'meta.lock.id': 1},
        options: {sparse: true, background: false}
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

api.queue.add = function(message, callback) {
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
              var now = Date.now();
              var q = {
                id: database.hash(message.recipient),
                'value.method': key,
                'value.interval': notifyMethod.interval,
                $or: [
                  {'meta.lock': {$exists: false}},
                  {'meta.lock.expires': {$lte: now}}
                ]
              };
              var u = {
                $set: {
                  'meta.lock': {id: jobId, expires: now + 5000}
                }
              };
              store.update(q, u, {}, callback);
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
              var q = {
                'meta.lock.id': jobId
              };
              var u = {
                $push: {'value.messages': database.hash(message.id)},
                $unset: {'meta.lock': ''}
              };
              store.update(q, u, {}, callback);
            }]
          }, callback);
        }, callback);
    }]
  }, callback);
};

// set a lock on a message job and return job details
api.queue.pull = function(options, callback) {
  var jobId = options.jobId;
  var lockDuration = options.lockDuration || 30000;
  var now = Date.now();
  var q = {
    'value.method': options.method,
    'value.interval': options.interval,
    $or: [
      {'meta.lock': {$exists: false}},
      {'meta.lock.expires': {$lte: now}}
    ]
  };
  var u = {
    $set: {
      'meta.lock': {
        id: jobId,
        expires: now + lockDuration
      }
    }
  };
  store.findAndModify(q, [], u, callback);
};

// remove job that was assigned a jobId
api.queue.remove = function(options, callback) {
  var jobId = options.jobId;
  var q = {
    'meta.lock.id': jobId
  };
  store.remove(q, callback);
};

function getId(id, callback) {
  var q = {
    id: database.hash(id)
  };
  userSettings.find(q).toArray(callback);
}

function updateSettings(options, callback) {
  var q = {
    id: database.hash(options.id)
  };
  var u = {
    $set: {
      id: database.hash(options.id),
      'value.email': options.email,
      'value.sms': options.sms
    }
  };
  userSettings.update(q, u, {upsert: true}, callback);
}
