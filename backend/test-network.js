// Simple network test server
const http = require('http');
const os = require('os');

const PORT = 5002;

const getLocalIP = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
};

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        message: 'Network test successful!',
        yourIP: req.socket.remoteAddress,
        serverIP: getLocalIP(),
        timestamp: new Date().toISOString()
    }));
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n🧪 Network Test Server Started`);
    console.log(`📱 Local: http://localhost:${PORT}`);
    console.log(`📱 Network: http://${localIP}:${PORT}`);
    console.log(`\n🔍 Test from another device:`);
    console.log(`   Open http://${localIP}:${PORT} on your mobile/tablet\n`);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Try a different port.`);
    }
});
