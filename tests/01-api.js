/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* globals describe, before, after, it, should, beforeEach, afterEach */
/* jshint node: true */
/* jshint -W030 */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brIdentity = require('bedrock-identity');
var brMessages = require('bedrock-messages');
var brPushMessages = require('../lib/push');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var helpers = require('./helpers');
var mockData = require('./mock.data');
var uuid = require('node-uuid').v4;

var store = database.collections.messagesPush;
var userSettings = database.collections.messagesPushUserSettings;

describe('bedrock-messages-push API', function() {
  before(function(done) {
    helpers.prepareDatabase(mockData, done);
  });
  after(function(done) {
    helpers.removeCollections(done);
  });
  describe('updateSettings function', function() {
    it('save a users notification settings', function(done) {
      var user = mockData.identities.rsa4096.identity.id;
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, user, callback);
        },
        act: ['getIdentity', function(callback, results) {
          var o = {
            id: user,
            email: {
              enable: true,
              interval: 'daily'
            }
          };
          brPushMessages._updateSettings(
            results.getIdentity[0], o, callback);
        }],
        checkDatabase: ['act', function(callback, results) {
          userSettings.find({}).toArray(callback);
        }],
        test: ['checkDatabase', function(callback, results) {
          should.exist(results.checkDatabase);
          results.checkDatabase[0].should.be.an('object');
          var settings = results.checkDatabase[0];
          should.exist(settings.id);
          settings.id.should.be.a('string');
          settings.id.should.equal(database.hash(user));
          should.exist(settings.value);
          settings.value.should.be.an('object');
          should.exist(settings.value.email);
          settings.value.email.should.be.an('object');
          should.exist(settings.value.email.enable);
          settings.value.email.enable.should.be.true;
          should.exist(settings.value.email.interval);
          settings.value.email.interval.should.be.a('string');
          settings.value.email.interval.should.equal('daily');
          callback();
        }]
      }, done);
    });
    it('update a users notification settings', function(done) {
      var user = mockData.identities.rsa4096.identity.id;
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, user, callback);
        },
        first: ['getIdentity', function(callback, results) {
          // save initial settings
          var o = {
            id: user,
            email: {
              enable: true,
              interval: 'daily'
            }
          };
          brPushMessages._updateSettings(results.getIdentity[0], o, callback);
        }],
        act: ['first', function(callback, results) {
          // update settings
          var o = {
            id: user,
            email: {
              enable: false,
              interval: 'immediate'
            }
          };
          brPushMessages._updateSettings(results.getIdentity[0], o, callback);
        }],
        checkDatabase: ['act', function(callback, results) {
          userSettings.find({id: database.hash(user)}).toArray(callback);
        }],
        test: ['checkDatabase', function(callback, results) {
          should.exist(results.checkDatabase);
          results.checkDatabase[0].should.be.an('object');
          var settings = results.checkDatabase[0];
          should.exist(settings.id);
          settings.id.should.be.a('string');
          settings.id.should.equal(database.hash(user));
          should.exist(settings.value);
          settings.value.should.be.an('object');
          should.exist(settings.value.email);
          settings.value.email.should.be.an('object');
          should.exist(settings.value.email.enable);
          settings.value.email.enable.should.be.false;
          should.exist(settings.value.email.interval);
          settings.value.email.interval.should.be.a('string');
          settings.value.email.interval.should.equal('immediate');
          callback();
        }]
      }, done);
    });
    it('does not allow changing another user\'s settings', function(done) {
      var userAlpha = mockData.identities.rsa4096.identity.id;
      var userBeta = mockData.identities.rsa2048.identity.id;
      async.auto({
        getIdentityAlpha: function(callback) {
          brIdentity.get(null, userAlpha, callback);
        },
        getIdentityBeta: function(callback) {
          brIdentity.get(null, userBeta, callback);
        },
        setAlpha: ['getIdentityAlpha', function(callback, results) {
          var o = {
            id: userAlpha,
            email: {
              enable: true,
              interval: 'daily'
            }
          };
          brPushMessages._updateSettings(
            results.getIdentityAlpha[0], o, callback);
        }],
        act: ['getIdentityBeta', 'setAlpha', function(callback, results) {
          // userBeta attempts to change userAlpha's settings
          var o = {
            id: userAlpha,
            email: {
              enable: false,
              interval: 'immediate'
            }
          };
          brPushMessages._updateSettings(
            results.getIdentityBeta[0], o, function(err, results) {
              // should return permission denied error
              should.exist(err);
              err.should.be.an('object');
              err.name.should.be.a('string');
              err.name.should.equal('PermissionDenied');
              should.exist(err.details);
              err.details.should.be.an('object');
              err.details.sysPermission.should.be.a('string');
              err.details.sysPermission.should.equal('MESSAGE_ACCESS');
              callback();
            });
        }],
        checkDatabase: ['act', function(callback, results) {
          userSettings.find({id: database.hash(userAlpha)}).toArray(callback);
        }],
        test: ['checkDatabase', function(callback, results) {
          // ensure that the settings were not changed
          var settings = results.checkDatabase[0];
          settings.value.email.enable.should.be.true;
          settings.value.email.interval.should.equal('daily');
          callback();
        }]
      }, done);
    });
  }); // end updateSettings
  describe('queue functions', function() {
    describe('queue.add function', function() {
      afterEach(function(done) {
        helpers.removeCollection('messagesPush', done);
      });
      it('adds a daily job to the queue if email is enabled', function(done) {
        // add settings
        // add call add
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          testResults: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.should.be.an('object');
            should.exist(results.act.email);
            results.act.email.should.be.an('object');
            should.exist(results.act.email.insert);
            results.act.email.insert.should.be.an('object');
            should.exist(results.act.email.insert.result);
            should.exist(results.act.email.insert.insertedCount);
            results.act.email.insert.insertedCount.should.equal(1);
            should.not.exist(results.act.email.update);
            callback();
          }],
          checkDatabase: ['act', function(callback) {
            store.find({id: database.hash(user)}).toArray(callback);
          }],
          testDatabase: ['checkDatabase', function(callback, results) {
            results.checkDatabase.should.have.length(1);
            var r = results.checkDatabase[0];
            should.exist(r.id);
            r.id.should.equal(database.hash(user));
            should.exist(r.value);
            r.value.should.be.an('object');
            should.exist(r.value.method);
            r.value.method.should.be.a('string');
            r.value.method.should.equal('email');
            should.exist(r.value.recipient);
            r.value.recipient.should.be.a('string');
            r.value.recipient.should.equal(user);
            should.exist(r.value.interval);
            r.value.interval.should.be.a('string');
            r.value.interval.should.equal('daily');
            should.exist(r.value.messages);
            r.value.messages.should.be.an('array');
            r.value.messages.should.have.length(1);
            r.value.messages[0].should.be.a('string');
            r.value.messages[0].should.equal(messageId);
            callback();
          }]
        }, done);
      });
      it('appends a message to an existing job', function(done) {
        // add settings
        // add call add
        var user = mockData.identities.rsa4096.identity.id;
        var messageIdAlpha = uuid();
        var messageIdBeta = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          first: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageIdAlpha
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          act: ['first', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageIdBeta
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          testResults: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.email.should.be.an('object');
            // this resut should indicate an update, not an insert
            should.not.exist(results.act.email.insert);
            should.exist(results.act.email.update);
            results.act.email.update.should.be.an('object');
            should.exist(results.act.email.update.result);
            should.exist(results.act.email.update.result.nModified);
            results.act.email.update.result.nModified.should.equal(1);
            callback();
          }],
          checkDatabase: ['act', function(callback) {
            store.find({id: database.hash(user)}).toArray(callback);
          }],
          testDatabase: ['checkDatabase', function(callback, results) {
            results.checkDatabase.should.have.length(1);
            var r = results.checkDatabase[0];
            r.value.messages.should.be.an('array');
            r.value.messages.should.have.length(2);
            r.value.messages[0].should.be.a('string');
            r.value.messages[0].should.equal(messageIdAlpha);
            r.value.messages[1].should.be.a('string');
            r.value.messages[1].should.equal(messageIdBeta);
            callback();
          }]
        }, done);
      });
      it('adds a job for each enabled notification method', function(done) {
        // add settings
        // add call add
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              },
              sms: {
                enable: true,
                interval: 'immediate'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          testResults: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.should.be.an('object');
            should.exist(results.act.email);
            results.act.email.should.be.an('object');
            should.exist(results.act.email.insert);
            results.act.email.insert.should.be.an('object');
            should.exist(results.act.email.insert.result);
            should.exist(results.act.email.insert.insertedCount);
            results.act.email.insert.insertedCount.should.equal(1);
            should.not.exist(results.act.email.update);
            results.act.sms.should.be.an('object');
            should.exist(results.act.sms.insert);
            results.act.sms.insert.should.be.an('object');
            should.exist(results.act.sms.insert.result);
            should.exist(results.act.sms.insert.insertedCount);
            results.act.sms.insert.insertedCount.should.equal(1);
            should.not.exist(results.act.sms.update);
            callback();
          }],
          checkDatabase: ['act', function(callback) {
            store.find({
              $query: {
                id: database.hash(user)
              },
              $orderby: {
                'value.method': 1
              }
            }).toArray(callback);
          }],
          testDatabase: ['checkDatabase', function(callback, results) {
            results.checkDatabase.should.have.length(2);
            var rAlpha = results.checkDatabase[0];
            rAlpha.value.method.should.equal('email');
            rAlpha.value.recipient.should.equal(user);
            rAlpha.value.interval.should.equal('daily');
            rAlpha.value.messages.should.have.length(1);
            rAlpha.value.messages[0].should.equal(messageId);
            var rBeta = results.checkDatabase[1];
            rBeta.value.method.should.equal('sms');
            rBeta.value.recipient.should.equal(user);
            rBeta.value.interval.should.equal('immediate');
            rBeta.value.messages.should.have.length(1);
            rBeta.value.messages[0].should.equal(messageId);
            callback();
          }]
        }, done);
      });
    }); // end queue.add
  });  // end queue functions
});
