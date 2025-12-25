const functions = require('firebase-functions/v2/https');
const app = require('../backend/app');

// HTTPS function that wraps the existing Express app.
// Deployed name: api
exports.api = functions.onRequest({ region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' }, app);
