/*
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
 /* globals describe, before, after, it, should, beforeEach, afterEach */
 /* jshint node: true */
 /* jshint -W030 */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brKey = require('bedrock-key');
var brPushMessages = require('../lib/push');
var config = bedrock.config;
var util = bedrock.util;
var helpers = require('./helpers');
var brIdentity = require('bedrock-identity');
var database = require('bedrock-mongodb');
var request = require('request');
var mockData = require('./mock.data');
var uuid = require('node-uuid').v4;
request = request.defaults({json: true});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var store = database.collections.messages;
var userSettings = database.collections.messagesPushUserSettings;

var settingsEndpoint =
  config.server.baseUri + config['messages-push'].endpoints.settings;

describe('bedrock-messages HTTP API', function() {
  describe('unauthenticated requests', function() {
    it('should respond with 400 - PermissionDenied', function(done) {
      var user = mockData.identities.rsa4096;
      request.post({
        url: settingsEndpoint + '/' + user.identity.id
      }, function(err, res, body) {
        should.not.exist(err);
        res.statusCode.should.equal(400);
        should.exist(body);
        body.should.be.an('object');
        body.type.should.be.a('string');
        body.type.should.equal('PermissionDenied');
        done();
      });
    });
  });
  describe('authenticated requests', function() {
    before('Prepare the database', function(done) {
      helpers.prepareDatabase(mockData, done);
    });
    after('Remove test data', function(done) {
      helpers.removeCollections(done);
    });
    afterEach(function(done) {
      helpers.removeCollections(
        {collections: ['messagesPushUserSettings']}, done);
    });
    describe('settings endpoint GET', function() {
      it('returns empty object if there are no settings', function(done) {
        var user = mockData.identities.rsa4096;
        request.get(
          helpers.createHttpSigRequest(
            settingsEndpoint + '/' + user.identity.id, user),
            function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              should.exist(body);
              body.should.be.an('object');
              _.isEmpty(body).should.be.true;
              done();
            });
      });
      it('returns a users settings if they exist', function(done) {
        var user = mockData.identities.rsa4096;
        async.auto({
          set: function(callback) {
            var o = {
              id: user.identity.id,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            request.get(helpers.createHttpSigRequest(
                settingsEndpoint + '/' + user.identity.id, user),
                function(err, res, body) {
                  should.not.exist(err);
                  res.statusCode.should.equal(200);
                  should.exist(body);
                  body.should.be.an('object');
                  should.exist(body.email);
                  body.email.should.be.an('object');
                  should.exist(body.email.enable);
                  body.email.enable.should.be.true;
                  should.exist(body.email.interval);
                  body.email.interval.should.be.a('string');
                  body.email.interval.should.equal('daily');
                  callback();
                });
          }]
        }, done);
      });
      it('does not allow access to another user\'s settings', function(done) {
        var user = mockData.identities.rsa4096;
        async.auto({
          set: function(callback) {
            var o = {
              id: user.identity.id,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            // authenticate as user rsa2048
            request.get(
              helpers.createHttpSigRequest(
                settingsEndpoint + '/' + user.identity.id,
                mockData.identities.rsa2048), function(err, res, body) {
                  should.not.exist(err);
                  res.statusCode.should.equal(403);
                  should.exist(body);
                  body.should.be.an('object');
                  should.exist(body.type);
                  body.type.should.be.a('string');
                  body.type.should.equal('PermissionDenied');
                  should.exist(body.details.sysPermission);
                  body.details.sysPermission.should.be.a('string');
                  body.details.sysPermission.should.equal('MESSAGE_ACCESS');
                  callback();
                });
          }]
        }, done);
      });
    }); // end settings GET
    describe('settings endpoint POST', function() {
      it('adds settings if none exist settings', function(done) {
        var user = mockData.identities.rsa4096;
        async.auto({
          act: function(callback) {
            var postRequest = helpers.createHttpSigRequest(
              settingsEndpoint + '/' + user.identity.id, user);
            postRequest.body = {
              id: user.identity.id,
              email: {
                enable: false,
                interval: 'immediate'
              }
            };
            request.post(postRequest, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(204);
              callback();
            });
          },
          checkDatabase: ['act', function(callback, results) {
            userSettings.find(
              {id: database.hash(user.identity.id)}).toArray(callback);
          }],
          test: ['checkDatabase', function(callback, results) {
            should.exist(results.checkDatabase);
            results.checkDatabase[0].should.be.an('object');
            var settings = results.checkDatabase[0];
            should.exist(settings.id);
            settings.id.should.be.a('string');
            settings.id.should.equal(database.hash(user.identity.id));
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
      it('updates existing settings', function(done) {
        var user = mockData.identities.rsa4096;
        async.auto({
          set: function(callback) {
            var o = {
              id: user.identity.id,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            var postRequest = helpers.createHttpSigRequest(
              settingsEndpoint + '/' + user.identity.id, user);
            postRequest.body = {
              id: user.identity.id,
              email: {
                enable: false,
                interval: 'immediate'
              }
            };
            request.post(postRequest, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(204);
              callback();
            });
          }],
          checkDatabase: ['act', function(callback, results) {
            userSettings.find(
              {id: database.hash(user.identity.id)}).toArray(callback);
          }],
          test: ['checkDatabase', function(callback, results) {
            should.exist(results.checkDatabase);
            results.checkDatabase[0].should.be.an('object');
            var settings = results.checkDatabase[0];
            should.exist(settings.id);
            settings.id.should.be.a('string');
            settings.id.should.equal(database.hash(user.identity.id));
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
      it('does not allow access to another user\'s settings', function(done) {
        var user = mockData.identities.rsa4096;
        async.auto({
          set: function(callback) {
            var o = {
              id: user.identity.id,
              email: {
                enable: true,
                interval: 'daily'
              }
            };
            brPushMessages._updateSettings(null, o, callback);
          },
          act: ['set', function(callback) {
            // authenticate as user rsa2048
            var postRequest = helpers.createHttpSigRequest(
              settingsEndpoint + '/' + user.identity.id,
              mockData.identities.rsa2048);
            postRequest.body = {
              id: user.identity.id,
              email: {
                enable: false,
                interval: 'daily'
              }
            };
            request.post(postRequest, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(403);
              should.exist(body);
              body.should.be.an('object');
              should.exist(body.type);
              body.type.should.be.a('string');
              body.type.should.equal('PermissionDenied');
              should.exist(body.details.sysPermission);
              body.details.sysPermission.should.be.a('string');
              body.details.sysPermission.should.equal('MESSAGE_ACCESS');
              callback();
            });
          }]
        }, done);
      });
    }); // end settings POST
  }); // end authenticated requests
});
