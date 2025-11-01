// Test setup after env for SAS (root)
// Make sure fetch is available in jsdom and timers can be controlled.

if (typeof fetch === 'undefined') {
  // Node 18+ has global fetch; for older versions, you may add a polyfill.
  global.fetch = (...args) => Promise.reject(new Error('fetch not mocked in tests: ' + JSON.stringify(args[0])));
}

// Helpful: use modern fake timers in tests that need debounce control
jest.useRealTimers();
