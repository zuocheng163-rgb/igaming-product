const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');

// Enable Demo Mode by default for seamless presentation
process.env.DEMO_MODE = process.env.DEMO_MODE || 'true';
const { logger, setDbLogHook } = require('./services/logger');
const supabaseService = require('./services/supabase');
const operatorRoutes = require('./routes/operator');
const providerRoutes = require('./routes/providers');
const { initSocket } = require('./services/socket');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sandboxMiddleware = require('./middleware/sandbox');

dotenv.config();

// Initialize Observability Bridge
setDbLogHook(supabaseService.saveAuditLog);

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel)
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// 1. Security Headers
app.use(helmet());
app.use(cors());
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

// Initialize WebSocket
initSocket(server);

// Sandbox Switch
app.use(sandboxMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    isSandbox: req.isSandbox
  });
  next();
});

// Routes
app.use('/api', authLimiter, operatorRoutes);
app.use('/api/webhooks', require('./routes/webhooks'));

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
