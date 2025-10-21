const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Middleware to debug file uploads and log request information
 */
const debugUpload = (req, res, next) => {
  console.log('-------- DEBUG UPLOAD MIDDLEWARE --------');
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', util.inspect(req.body, {depth: null}));
  console.log('Request Files:', util.inspect(req.files, {depth: null}));
  console.log('Form Data Field Names:', Object.keys(req.body));
  
  if (req.files) {
    console.log('File Field Names:', Object.keys(req.files));
  }
  
  console.log('----------------------------------------');
  next();
};

module.exports = debugUpload;