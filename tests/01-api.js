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
var brNotifications = require('bedrock-notifications');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var helpers = require('./helpers');
var mockData = require('./mock.data');
var uuid = require('node-uuid').v4;

var store = database.collections.messagesPush;
var userSettings = database.collections.notificationPushUserSettings;

describe('bedrock-messages-push API', function() {
  before(function(done) {
    helpers.prepareDatabase(mockData, done);
  });
  after(function(done) {
    helpers.removeCollections(done);
  });
  describe('queue functions', function() {
    describe('queue.add function', function() {
      afterEach(function(done) {
        helpers.removeCollections(
          {collections: ['messagesPush', 'notificationPushUserSettings']}, done);
      });
      it('adds a daily job to the queue if email is enabled', function(done) {
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
            brNotifications._updateSettings(null, o, callback);
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
            brNotifications._updateSettings(null, o, callback);
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
            brNotifications._updateSettings(null, o, callback);
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
    describe('queue.pull function', function() {
      afterEach(function(done) {
        helpers.removeCollections(
          {collections: ['messagesPush', 'notificationPushUserSettings']}, done);
      });
      it('returns null if there are no matching jobs', function(done) {
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        var jobId = uuid();
        async.auto({
          act: function(callback, results) {
            var o = {
              jobId: jobId,
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          },
          testResults: ['act', function(callback, results) {
            should.not.exist(results.act);
            callback();
          }]
        }, done);
      });
      it('pull a job from the queue with a lock', function(done) {
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        var jobId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brNotifications._updateSettings(null, o, callback);
          },
          addJob: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          act: ['addJob', function(callback, results) {
            var o = {
              jobId: jobId,
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          }],
          testResults: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.should.be.an('object');
            var r = results.act;
            should.exist(r.method);
            r.method.should.be.a('string');
            r.method.should.equal('email');
            should.exist(r.recipient);
            r.recipient.should.be.a('string');
            r.recipient.should.equal(user);
            should.exist(r.interval);
            r.interval.should.be.a('string');
            r.interval.should.equal('daily');
            should.exist(r.messages);
            r.messages.should.be.an('array');
            r.messages.should.have.length(1);
            r.messages[0].should.be.a('string');
            r.messages[0].should.equal(messageId);
            callback();
          }],
          checkDatabase: ['act', function(callback) {
            store.find({id: database.hash(user)}).toArray(callback);
          }],
          testDatabase: ['checkDatabase', function(callback, results) {
            var r = results.checkDatabase[0].value;
            // a lock should have been added to the job
            should.exist(r.meta);
            r.meta.should.be.an('object');
            should.exist(r.meta.lock);
            r.meta.lock.should.be.an('object');
            var lock = r.meta.lock;
            should.exist(lock.id);
            lock.id.should.be.a('string');
            lock.id.should.equal(jobId);
            should.exist(lock.expires);
            lock.expires.should.be.a('number');
            lock.expires.should.be.gt(Date.now());
            callback();
          }]
        }, done);
      });
      it('returns null if a queued job has an active lock', function(done) {
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        var jobId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brNotifications._updateSettings(null, o, callback);
          },
          addJob: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          first: ['addJob', function(callback, results) {
            var o = {
              jobId: jobId,
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          }],
          checkFirst: ['first', function(callback, results) {
            // successfully pulls job the first time with a 30 sec lock
            var r = results.first;
            r.messages[0].should.equal(messageId);
            callback();
          }],
          act: ['checkFirst', function(callback, results) {
            // new jobId used here
            var o = {
              jobId: uuid(),
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          }],
          test: ['act', function(callback, results) {
            should.not.exist(results.act);
            callback();
          }]
        }, done);
      });
      it('returns a job with an expired lock', function(done) {
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        var jobId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brNotifications._updateSettings(null, o, callback);
          },
          addJob: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          first: ['addJob', function(callback, results) {
            // specify a short lock duration for test
            var o = {
              jobId: jobId,
              method: 'email',
              interval: 'daily',
              lockDuration: 100
            };
            brPushMessages.queue.pull(o, callback);
          }],
          checkFirst: ['first', function(callback, results) {
            var r = results.first;
            r.messages[0].should.equal(messageId);
            callback();
          }],
          wait: ['checkFirst', function(callback) {
            setTimeout(callback, 200);
          }],
          act: ['wait', function(callback, results) {
            // new jobId used here
            var o = {
              jobId: uuid(),
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          }],
          test: ['act', function(callback, results) {
            var r = results.act;
            r.messages[0].should.equal(messageId);
            callback();
          }]
        }, done);
      });
    }); // end queue.pull
    describe('queue.remove function', function() {
      afterEach(function(done) {
        helpers.removeCollections(
          {collections: ['messagesPush', 'notificationPushUserSettings']}, done);
      });
      it('removes a job by jobId', function(done) {
        var user = mockData.identities.rsa4096.identity.id;
        var messageId = uuid();
        var jobId = uuid();
        async.auto({
          set: function(callback) {
            var o = {
              id: user,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brNotifications._updateSettings(null, o, callback);
          },
          addJob: ['set', function(callback) {
            var messageEvent = {
              recipient: user,
              id: messageId
            };
            brPushMessages.queue.add(messageEvent, callback);
          }],
          pullJob: ['addJob', function(callback, results) {
            var o = {
              jobId: jobId,
              method: 'email',
              interval: 'daily'
            };
            brPushMessages.queue.pull(o, callback);
          }],
          checkPull: ['pullJob', function(callback, results) {
            // ensure that job does exist
            var r = results.pullJob;
            r.messages[0].should.equal(messageId);
            callback();
          }],
          act: ['checkPull', function(callback) {
            // TODO: See if this test was breaking before, too (was putting in
            // jobId when it was meant to be passed as an option type)
            brPushMessages.queue.remove({jobId: jobId}, callback);
          }],
          checkResult: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.should.be.an('object');
            should.exist(results.act.n);
            results.act.n.should.be.a('number');
            results.act.n.should.equal(1);
            callback();
          }],
          checkDatabase: ['act', function(callback) {
            store.find({id: database.hash(user)}).toArray(callback);
          }],
          testDatabase: ['checkDatabase', function(callback, results) {
            should.exist(results.checkDatabase);
            results.checkDatabase.should.be.an('array');
            results.checkDatabase.should.have.length(0);
            callback();
          }]
        }, done);
      });
      it('does nothing if jobId is not found', function(done) {
        var jobId = uuid();
        async.auto({
          act: function(callback) {
            brPushMessages.queue.remove(jobId, callback);
          },
          checkResult: ['act', function(callback, results) {
            should.exist(results.act);
            results.act.should.be.an('object');
            should.exist(results.act.n);
            results.act.n.should.be.a('number');
            results.act.n.should.equal(0);
            callback();
          }]
        }, done);
      });
    }); // end queue.remove
  });  // end queue functions
});
