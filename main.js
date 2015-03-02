var http = require('http');
var express = require('express');
var OAuth = require('oauth');
var util = require('util');
var session = require('express-session');
var mailer = require('nodemailer');

// client must pass in two args
if (process.argv.length != 6) {
  console.log('ERROR: Insufficient arguments');
  console.log();
  console.log('Usage:');
  console.log('  node main.js <fitbit-client-key> <fitbit-client-secret> <gmail account> <gmail password>');
  console.log();
  return;
}

var host = '0.0.0.0';
var port = 8083;

var clientKey = process.argv[2];
var clientSecret = process.argv[3];

var oauth = new OAuth.OAuth(
  'https://api.fitbit.com/oauth/request_token',
  'https://api.fitbit.com/oauth/access_token',
  clientKey,
  clientSecret,
  '1.0',
  // can specify callback explicitly but we'll let fitbit use the one registered with them
  null,
  'HMAC-SHA1'
);

var gmailUser = process.argv[4];
var gmailPassword = process.argv[5];

var gmail = mailer.createTransport({
    service: 'Gmail',
    auth: {
        user: gmailUser,
        pass: gmailPassword,
    }
});

function sendDetailsViaEmail(userId, accessToken, accessTokenSecret) {
    var message = {
        from: gmailUser,
        to: gmailUser,
        subject: 'fitbit user registration',
        text:
            'userId: ' + userId + '\n' +
            'accessToken: ' + accessToken + '\n' +
            'accessTokenSecret: ' + accessTokenSecret + '\n',
    };
    gmail.sendMail(message, function(error, info) { });
}

function home(req, res) {

  if (!req.session || !req.session.oauth || !req.session.oauth.accessToken || !req.session.oauth.accessTokenSecret || !req.session.oauth.userId) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<pre>please click <a href="/login">here</a> to authorise scott to access your fitbit data</pre>');
  }

  // get some data
  /*
  oauth.get(
    'https://api.fitbit.com/1/user/' + req.session.oauth.userId + '/activities/date/2015-02-04.json',
    req.session.oauth.accessToken,
    req.session.oauth.accessTokenSecret,
    function(e, data, results) {
      if (e) {
        res.writeHead(500, { 'content-type': 'text/html' });
        return res.end('Problem retrieving data: ' + JSON.stringify(e));
      }

      res.writeHead(200, { 'content-type': 'text/html' });

      res.write('<pre>user is logged in:      ' + req.session.oauth.userId + '</br>');
      res.write('accessToken:            ' + req.session.oauth.accessToken + '</br>');
      res.write('accessTokenSecret:      ' + req.session.oauth.accessTokenSecret + '</br>');
      res.write('</br>');

      data = JSON.parse(data); 
      var trackerDistance = 0;
      data.summary.distances.forEach(function(distance) {
        if (distance.activity == "tracker") {
          trackerDistance = distance.distance;
        }
      });

      // data items of interest
      res.write('steps:                  ' + data.summary.steps + '</br>');
      res.write('lightlyActiveMinutes:   ' + data.summary.lightlyActiveMinutes + '</br>');
      res.write('fairlyActiveMinutes:    ' + data.summary.fairlyActiveMinutes + '</br>');
      res.write('veryActiveMinutes:      ' + data.summary.veryActiveMinutes + '</br>');
      res.write('steps:                  ' + data.summary.steps + '</br>');
      res.write('distance (tracker):     ' + trackerDistance + '</br>');
      res.write('</br>');

      res.write('<a href="/logout">logout</a><br/>');

      // rest of the data
      //res.write(JSON.stringify(data, null, 4));
      //res.write('</br>');

      // finish up
      res.end();

      sendDetailsViaEmail(req.session.oauth.userId, req.session.oauth.accessToken, req.session.oauth.accessTokenSecret);
    }
  );
  */

  res.writeHead(200, { 'content-type': 'text/html' });
  res.write('<pre>you have authorised your account\n\nyou can revoke access at any time by going to <a href="https://www.fitbit.com/user/profile/apps">https://www.fitbit.com/user/profile/apps</a> and clicking on "Revoke Access"</pre>');
  res.end();
  sendDetailsViaEmail(req.session.oauth.userId, req.session.oauth.accessToken, req.session.oauth.accessTokenSecret);
}

function getAuthorisationToken(req, res) {
  console.log('Getting OAuth access tokens');
  oauth.getOAuthRequestToken(function(e, token, tokenSecret, results) {
    if (e) {
      res.write('Failed to get OAuth access token');
      res.write('ERROR:<br/>');
      res.write(JSON.stringify(e));
      res.end();
      return;
    }

    // got the initial authorisation tokens, cache them in the session and redirect to the
    // user authorisation page
    console.log('got initial authorisation token');
    req.session.oauth = { };
    req.session.oauth.token = token;
    req.session.oauth.token_secret = tokenSecret;
   
    // can redirect to two places here:
    //  (1) fitbit basic authorisation workflow
    //        https://www.fitbit.com/oauth/authorize?oauth_token=...
    //  (2) fitbit extended authorisation workflow (for 'login with fitbit buttons')
    //        https://www.fitbit.com/oauth/authenticate?oauth_token=...
    console.log('redirecting to fitbit authorisation page'); 
    res.redirect('https://www.fitbit.com/oauth/authorize?oauth_token=' + token);
    //res.redirect('https://www.fitbit.com/oauth/authenticate?oauth_token=' + token);
    return;
  });
}

function getAccessToken(req, res) {
  if (!req.session.oauth) {
    return res.end("ERROR: Can't get access token with no oauth details in the session");
  }

  // cache the verifier details in the session
  req.session.oauth.verifier = req.query.oauth_verifier;

  // get the access token from fitbit
  console.log('Getting oauth access token from fitbit');
  oauth.getOAuthAccessToken(
    req.session.oauth.token,
    req.session.oauth.token_secret,
    req.session.oauth.verifier,
    function(error, accessToken, accessTokenSecret, results) {
      if (error) {
        return res.end('ERROR: Problem getting access token:<br/>' + JSON.stringify(error));
      }
      req.session.oauth.accessToken = accessToken;
      req.session.oauth.accessTokenSecret = accessTokenSecret;
      req.session.oauth.userId = results.encoded_user_id;
      res.redirect('/');
    }
  );
}

function logout(req, res) {
  console.log('logging out');
  req.session.oauth = null;
  res.redirect('/');
}

// express setup
var app = express();
app.use(session({
  secret: 'fitbit fun times!',
  resave: false,
  saveUninitialized: false,
}));

// routes
app.get('/', home);
app.get('/login', getAuthorisationToken);
app.get('/logout', logout);
app.get('/authorised', getAccessToken);

// http server pulls it all together
var server = http.Server(app);
server.listen(port, host, function() {
  console.log('server started listening on ' + host + ':' + port);
});

