const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * Health Check Routes
 * Used by monitoring services and Render to verify service is running
 */

// @desc    Basic health check
// @route   GET /api/health
// @access  Public
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'SAS Application is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5001
  });
});

// @desc    Database health check
// @route   GET /api/health/db
// @access  Public
router.get('/db', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    if (dbState === 1) {
      // Database is connected
      res.status(200).json({
        status: 'ok',
        database: 'connected',
        state: states[dbState],
        host: mongoose.connection.host || 'unknown',
        name: mongoose.connection.name || 'unknown',
        timestamp: new Date().toISOString()
      });
    } else {
      // Database is not connected
      res.status(503).json({
        status: 'error',
        database: 'not connected',
        state: states[dbState],
        message: 'Database connection is not established',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// @desc    Detailed system information
// @route   GET /api/health/system
// @access  Public (consider adding auth in production)
router.get('/system', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    status: 'ok',
    system: {
      nodejs: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuUsage: process.cpuUsage(),
      memory: {
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB'
      },
      uptime: Math.floor(process.uptime()) + ' seconds',
      pid: process.pid
    },
    timestamp: new Date().toISOString()
  });
});

// @desc    Quick ping endpoint (minimal response)
// @route   GET /api/health/ping
// @access  Public
router.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

module.exports = router;
