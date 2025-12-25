const functions = require('firebase-functions/v2/https');
const app = require('../backend/app');

exports.api = functions.onRequest(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 540 },
  app
);