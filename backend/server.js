const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { logger, setDbLogHook } = require('./services/logger');
const supabaseService = require('./services/supabase');
const operatorRoutes = require('./routes/operator');

dotenv.config();

// Initialize Observability Bridge
setDbLogHook(supabaseService.saveAuditLog);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Routes
app.use('/api', operatorRoutes);

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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
