/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var BedrockError = bedrock.util.BedrockError;
var brNotifications = require('bedrock-notifications');
var brPassport = require('bedrock-passport');
var brPermission = require('bedrock-permission');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var ensureAuthenticated = brPassport.ensureAuthenticated;
var rest = require('bedrock-rest');
var uuid = require('node-uuid').v4;
// var validate = require('bedrock-validation').validate;
var store = null;

// load config
require('./config');

// module permissions
var PERMISSIONS = config.permission.permissions;

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
      database.openCollections(['messagesPush'], function(err) {
        if(!err) {
          store = database.collections.messagesPush;
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
        fields: {'value.meta.lock.id': 1},
        options: {sparse: true, background: false}
      }], callback);
    }]
  }, function(err) {
    callback(err);
  });
});

api.queue.add = function(message, callback) {
  // determine if recipient has any notification settings
  // add message to the queue based on those preferences
  async.auto({
    getSettings: function(callback) {
      brNotifications.getId(null, message.recipient, callback);
    },
    queue: ['getSettings', function(callback, results) {
      if(_.isEmpty(results.getSettings)) {
        // user has not setup any message push settings
        return callback();
      }
      var methodResults = {};
      async.forEachOf(
        results.getSettings, function(notifyMethod, key, callback) {
          if(!notifyMethod) {
            return callback(
              new Error('notifyMethod should not be null: ' + key));
          }
          if(!notifyMethod.enable) {
            return callback();
          }
          var jobId = uuid();
          async.auto({
            lock: function(callback) {
              var now = Date.now();
              var q = {
                id: database.hash(message.recipient),
                'value.method': key,
                'value.interval': notifyMethod.interval,
                $or: [
                  {'value.meta.lock': {$exists: false}},
                  {'value.meta.lock.expires': {$lte: now}}
                ]
              };
              var u = {
                $set: {
                  'value.meta.lock': {id: jobId, expires: now + 5000}
                }
              };
              store.update(q, u, database.writeOptions, callback);
            },
            insert: ['lock', function(callback, results) {
              if(results.lock.result.nModified > 0) {
                return callback();
              }
              var value = {
                id: database.hash(message.recipient),
                'value': {
                  method: key,
                  recipient: message.recipient,
                  interval: notifyMethod.interval,
                  messages: [message.id]
                }
              };
              store.insert(value, database.writeOptions, callback);
            }],
            update: ['lock', function(callback, results) {
              if(results.lock.result.nModified === 0) {
                return callback();
              }
              var q = {
                'value.meta.lock.id': jobId
              };
              var u = {
                $push: {'value.messages': message.id},
                $unset: {'value.meta.lock': ''}
              };
              store.update(q, u, database.writeOptions, callback);
            }]
          }, function(err, results) {
            if(err) {
              return callback(err);
            }
            var result = {
              insert: results.insert,
              update: results.update
            };
            methodResults[key] = result;
            callback(null, result);
          });
        }, function(err) {
          callback(err, methodResults);
        });
    }]
  }, function(err, results) {
    callback(err, results.queue);
  });
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
      {'value.meta.lock': {$exists: false}},
      {'value.meta.lock.expires': {$lte: now}}
    ]
  };
  var u = {
    $set: {
      'value.meta.lock': {
        id: jobId,
        expires: now + lockDuration
      }
    }
  };
  store.findAndModify(q, [], u, database.writeOptions, function(err, results) {
    if(results.value) {
      return callback(null, results.value.value);
    }
    callback(err, results.value);
  });
};

// remove job that was assigned a jobId
api.queue.remove = function(options, callback) {
  var jobId = options.jobId;
  var q = {
    'value.meta.lock.id': jobId
  };
  store.remove(q, database.writeOptions, function(err, results) {
    callback(err, results.result);
  });
};
