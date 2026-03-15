const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const cors = require('cors');

const { logger, setDbLogHook } = require('./services/logger');
const supabaseService = require('./services/supabase');
const operatorRoutes = require('./routes/operator');
const providerRoutes = require('./routes/providers');
// const { initSocket } = require('./services/socket');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sandboxMiddleware = require('./middleware/sandbox');

// Initialize Observability Bridge
setDbLogHook(supabaseService.saveAuditLog);

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel)
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// 1. Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

// Robust CORS for local development and production
app.use(cors({
  origin: true, // Allow all origins in PoC for flexibility, or specify ['http://localhost:5173']
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-brand-id', 'x-api-key', 'x-username', 'x-sandbox-mode']
}));
app.use(express.json());

// 2. Global Rate Limiting (General Protection)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(globalLimiter);

// 3. Strict Rate Limiting for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 auth attempts per hour
  message: 'Too many authentication attempts, please try again later'
});

// Initialize WebSocket - REMOVED for Serverless Architecture
// initSocket(server);

// 1. Request logging middleware (MOVE TO TOP)
app.use((req, res, next) => {
  logger.info(`[Incoming] ${req.method} ${req.path}`, {
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

const { featureGate } = require('./middleware/feature-gate');

// 2. Sandbox Switch
app.use(sandboxMiddleware);


// Routes
app.use('/api/authenticate', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/user', require('./routes/user'));
app.use('/api', operatorRoutes);
app.use('/api/v1/games', featureGate('GAMES'), require('./routes/games'));
app.use('/api/v1/kyc', featureGate('KYC'), require('./routes/kyc'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/providers', featureGate('PROVIDERS'), require('./routes/providers'));
app.use('/api/promotions', require('./routes/promotions'));

app.get('/', (req, res) => {
  res.send('iGaming Integration Platform Backend Running');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Professional Error Handling
app.use((err, req, res, next) => {
  logger.error('Unhandled Exception', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
