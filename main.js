var OAuth = require('oauth');
var util = require('util');

// client must pass in two args
if (process.argv.length != 4) {
  console.log('ERROR: Insufficient arguments');
  console.log();
  console.log('Usage:');
  console.log('  node main.js <fitbit-client-key> <fitbit-client-secret>');
  console.log();
  return;
}

var clientKey = process.argv[2];
var clientSecret = process.argv[3];

console.log('clientKey:    ' + clientKey);
console.log('clientSecret: ' + clientSecret);

var oauth = new OAuth.OAuth(
  'https://api.fitbit.com/oauth/request_token',
  'https://api.fitbit.com/oauth/access_token',
  clientKey,
  clientSecret,
  '1.0',
  null,
  'HMAC-SHA1'
);

console.log('Getting OAuth access tokens');
oauth.getOAuthRequestToken(function(e, token, tokenSecret, results) {
  if (e) {
    console.log('ERROR:');
    console.log(JSON.stringify(e, null, 2));
    return;
  }

  console.log('token:        ' + token);
  console.log('tokenSecret:  ' + tokenSecret);
  console.log('Test retrieval of recent data');

  // think there's another step here which will involve redirection of a web-based user to 
  // fitbit for login / authorisation

  // how can this be done programmatically without a user interaction?

  oauth.get(
    'https://api.fitbit.com/1/user/35X6LR/activities/date/2015-02-04.json',
    token,
    tokenSecret,
    function(e, data, res) {
      console.log('oauth get callback');
      if (e) {
        console.error('ERROR:');
        console.log(JSON.stringify(e, null, 2));
        return;
      }
      console.log('Retrieval succeeded');
      console.log(JSON.stringify(data, null, 2));
    }
  );
});

