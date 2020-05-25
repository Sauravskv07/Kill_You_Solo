'use strict';
const fs = require('fs');

const https = require('https');

const express = require('express');

const logger = require('morgan');

const bodyParser = require('body-parser');

let privateKey = fs.readFileSync(__dirname + '/certs/save_the_solo.key');
let certificate = fs.readFileSync(__dirname + '/certs/save_the_solo.crt');
let credentials = {key: privateKey, cert: certificate};

const app = express();

process.env.NODE_ENV !== 'production' && app.use(logger('combined'));
  
app.use(bodyParser.json());
app.use(sessionParser);

let httpsServer = https.createServer(credentials, app);

let wss = require('./lib/websocket.js')(httpsServer);

httpsServer.listen(process.env.HTTPS_PORT, () => {
  console.log('HTTPS Server Listening on port number ', process.env.HTTPS_PORT);
});
