const app = require('./app');

const PORT = process.env.PORT || 5001;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`📱 Access your site: http://localhost:${PORT}`);
        console.log(`🔗 API endpoints: http://localhost:${PORT}/api/`);
        console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;