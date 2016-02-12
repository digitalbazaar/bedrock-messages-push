/*
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

var helpers = require('./helpers');

var data = {};
module.exports = data;

var identities = {};
data.identities = identities;

// user with a valid 4096 bit RSA keypair and issuer permissions
var userName = 'rsa4096';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);
identities[userName].identity.sysResourceRole.push({
  sysRole: 'messages.user',
  generateResource: 'id'
});
identities[userName].keys = helpers.createKeyPair({
  userName: userName,
  userId: identities[userName].identity.id,
  publicKey: '-----BEGIN PUBLIC KEY-----\n' +
    'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAxBTbcgMr6WY74XoUkXBg\n' +
    'n+0PUP2XE4fbcvALoBSBIlMcWep8TUl4/BGM2FBwbgeEgp9ZRJ8dObiK+ZqQjFOh\n' +
    'Gfj0PYP3Xb0c5Djrm0qmC8NRgVO4h2QNEX3Keps1bC6+S096n5XS9qiRsMfr4vN5\n' +
    'ohV9svSP9mmRs+iEs3UBWJl6uoMpkopCxViI1GhhYGjCoB+MGnVJbgEwPjA4POAm\n' +
    'WyMm76tSx0vpI0HLFdN0S9tghrl4jkAzFaBILMfoakx/LpFOiAApivM7HF6YeDZT\n' +
    'MOk6wVYMbbd1jiiy4PLj+nKl96K7RMU+RQZekAZ6Y2FU7wrAbOVBwaXaaRUTVIrN\n' +
    'hOCl7ihXo4w348rVNmDT0pejbSx2QbOY/X7NfUePIkOpyekRChGCrQL3KIicpKCA\n' +
    'bJG83U4niPsynBI3Y/zWvDgs8R/FxEc/UdlBB6Mr9jAeOhbY5vhH1E5dyThJD9Px\n' +
    'pmlY2PuzeAUscsfoXzxHRo2CLzanbvKJKXxMpMVl9lPyvVQHAevVZJO+kJf+Mpzw\n' +
    'Q5X4x/THt7NpSLDjpTsISQGc+0X3DhKvYzcW0iW/bDc9IqXuCPGqa/xf7XhNRLzg\n' +
    '41J2uX0nX9yWwl1opexN3dCxCsYNKTqBTq3uY1aK6WnWWXWt4t8G42A3bKv/7Ncu\n' +
    '9jEBOHnbHLXdQPk+q6wFNfECAwEAAQ==\n' +
    '-----END PUBLIC KEY-----\n',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
    '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\n' +
    '-----END RSA PRIVATE KEY-----\n'
});
// user with a valid 2048 bit RSA keypair and issuer permissions
var userName = 'rsa2048';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);
identities[userName].identity.sysResourceRole.push({
  sysRole: 'messages.user',
  generateResource: 'id'
});
identities[userName].keys = helpers.createKeyPair({
  userName: userName,
  userId: identities[userName].identity.id,
  publicKey: '-----BEGIN PUBLIC KEY-----\n' +
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsP2dp4bX8tG8UczH3/Sk\n' +
    '/dornrCg7Nhm2N0fIX2v4irEFOQNTqaAJw9PGOKLYxSzkf/Iu8drLDQc4ITZhAXl\n' +
    'GEnY7OhmAbGLGijNNgsbKSDzbWqhAt6k6JAFg4D0pE2CMsoTJK2tqXZW5Tz1FIFo\n' +
    'XjBotJUTy4cCKkDpJu6bSI3s8hVZy0cLL8EpY9UmyAWC374IsXwQ2I3BT1Q15S1g\n' +
    'Ufb+URpPnTeNjNVD0KHihSHyL94+Ph9b4IOe1tZw+bHKePHEtTlTRA1ES86c+d2f\n' +
    'mncxKNN/ljvzRn+OIRaY2QM/01uyGgtu4Y7z9qnJmoIWSzPFNNX9aTC+V6Z0k4HY\n' +
    '3QIDAQAB\n' +
    '-----END PUBLIC KEY-----\n',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
    'MIIEpQIBAAKCAQEAsP2dp4bX8tG8UczH3/Sk/dornrCg7Nhm2N0fIX2v4irEFOQN\n' +
    'TqaAJw9PGOKLYxSzkf/Iu8drLDQc4ITZhAXlGEnY7OhmAbGLGijNNgsbKSDzbWqh\n' +
    'At6k6JAFg4D0pE2CMsoTJK2tqXZW5Tz1FIFoXjBotJUTy4cCKkDpJu6bSI3s8hVZ\n' +
    'y0cLL8EpY9UmyAWC374IsXwQ2I3BT1Q15S1gUfb+URpPnTeNjNVD0KHihSHyL94+\n' +
    'Ph9b4IOe1tZw+bHKePHEtTlTRA1ES86c+d2fmncxKNN/ljvzRn+OIRaY2QM/01uy\n' +
    'Ggtu4Y7z9qnJmoIWSzPFNNX9aTC+V6Z0k4HY3QIDAQABAoIBAAlzEPa/yUnKjt5j\n' +
    'K4y2eBShkFChp4Xdq+gKLj5QgpJ1rBBdeKRpWVA8jgGLHtwEX+38lRAJfpxWj/Ag\n' +
    'x6g31FpunulPIxsWCpIz+XjYMPQKMVT3K2+GyZEtF05FFUqsZLYnecwshagVjGAi\n' +
    '2AbnPdZBiWWSzALCy4fL/Wa5uIqwClf7cnfFWjRnEmvSPmjNj2hYz3KilU2KCcrs\n' +
    'nQVSWyFRxTypHDg+Mh5ABI9yZw32ACQkE3bYFY3rFhOodX6lkgwq3+41SEwrOHTU\n' +
    'Z+7oYTjrVMiB/jE1AoNA6j1J15WrJq1gPvNfCwN1QwrZHYpTs6FZyiHEJSvvB0ng\n' +
    'rgOOddUCgYEA5qxTBrITX9v+CApRxcxCFN998//lXWyDYHInj9chVtsdagFb0CnE\n' +
    'xyuOLFd5GogBMoWTWf8/wgZBMRAdOVMU2TW8IYXecNWMT5qVSrU7k7owMaWxpNC/\n' +
    'cLcbJot7cRmQmij3QECJeMGjYQRjCDdrzwGSdFL6YmAjRSAhu7TK1c8CgYEAxGxn\n' +
    'pEtVCKEAvz6vxbn9zIkM9FKeriUxbG00Qv7ynbfA4egebJ8+N4geIkR77oT9LwKV\n' +
    '1xT70CPQu5FrzIgGnP8+/seqmJOPUsb2r7+ZLx5/y4EsVsT1ndS4XE1jMbvh1Kvc\n' +
    'e4kHKhuCnt0xlSntrPs9tGrfj5207djGELjtfZMCgYEAm/lFoq9iflzoplMj+9Uj\n' +
    'ka2VIxmS49rt8pb9vTtAJdS/TOBiTp0Pm4UN+1miX5g7BwhfHGmFmRJVnnFA8XQG\n' +
    'EuFMtnYodK9Q0rq52+wzvq4UzF03gzRLXlHRn/yMmWsp5bNxjBaXXfnBGWa39+RR\n' +
    'l4V+m/1HpKFQ9/rEFIIo7O0CgYEAsSnxxS8pMFI/oT9CPP5H237Vz1zhwMLNNDW/\n' +
    'SJo5bGX7tAavwltTO7UrMM9CVN1gm1Eio09K3O4g67z7VQxvopVaVWT0CxA02n2Y\n' +
    'rOYMnYJN09jbjBu0Sbo+2wn16TrEMxUcFdR/QMx1YSKzAQ5DUJ1/h0ZKBHhDY6/8\n' +
    '3cJeer8CgYEAz08aCpN/Lu4I/m7mJ5Gs5DB9SITzqjmfMS8FHz4m/6YuSCSkn5dQ\n' +
    'Jew7+XPigBMsixhwtQ0Y+LGtc2eZo8OWZUshRH6OW6lzpJffUNhlvq8whcWbbq3N\n' +
    'FHRRK8QApK9K9CQXSXvPO/GTBb2fAtEzOdeeqUZR4BgAeV5104PgTAM=\n' +
    '-----END RSA PRIVATE KEY-----\n'
});
