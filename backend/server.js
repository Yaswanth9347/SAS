const app = require('./app');

// Export the app for Vercel serverless functions
module.exports = app;

// Only listen when running locally (not on Vercel)
if (require.main === module && process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`📱 Access your site: http://localhost:${PORT}`);
        console.log(`🔗 API endpoints: http://localhost:${PORT}/api/`);
        console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    });
}