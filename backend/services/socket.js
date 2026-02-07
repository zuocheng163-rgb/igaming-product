const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const { logger } = require('./logger');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // Redis Adapter for Horizontal Scaling
    if (process.env.REDIS_URL) {
        const pubClient = new Redis(process.env.REDIS_URL);
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter initialized');
    }

    // Authentication Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        const headers = socket.handshake.headers;
        const auth = socket.handshake.auth;

        // Check for sandbox flag in auth object (preferred) or headers
        const isSandbox = (auth && (auth.sandbox === true || auth.sandbox === 'true')) ||
            headers['x-sandbox-mode'] === 'true' ||
            process.env.DEMO_MODE === 'true';

        logger.info('[Socket] Handshake Debug', {
            token: token ? (token.substring(0, 10) + '...') : 'MISSING',
            isSandbox,
            authSandbox: auth?.sandbox,
            sandboxHeader: headers['x-sandbox-mode'],
            demoEnv: process.env.DEMO_MODE
        });

        if (!token) {
            logger.warn('[Socket] Token missing in handshake');
            return next(new Error('Authentication error: Token missing'));
        }

        // 1. Sandbox/Demo Bypass: Allow tokens starting with 'token-' during demo mode
        if (isSandbox && token.startsWith('token-')) {
            const username = token.replace('token-', '');
            socket.user = { userId: username, username: username }; // Map to user_id for rooms
            return next();
        }

        // 2. Production JWT Verification
        jwt.verify(token, process.env.JWT_SECRET || 'neostrike-local-secret-key-123', (err, decoded) => {
            if (err) {
                logger.warn(`Socket Auth Failed: ${err.message}`, { token });
                return next(new Error('Authentication error: Invalid token'));
            }
            socket.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        const { userId } = socket.user;
        logger.info(`User connected to WebSocket: ${userId} (Socket ID: ${socket.id})`);

        // Join a room specific to the user for targeted broadcasts (e.g., balance updates)
        socket.join(`user:${userId}`);

        socket.on('disconnect', () => {
            logger.info(`User disconnected from WebSocket: ${userId}`);
        });
    });

    return io;
};

const broadcastToUser = (userId, event, data) => {
    if (!io) {
        logger.error('Socket.io not initialized. Cannot broadcast.');
        return;
    }
    io.to(`user:${userId}`).emit(event, data);
    logger.info(`Broadcasted ${event} to user:${userId}`);
};

const broadcastToAll = (event, data) => {
    if (!io) return;
    io.emit(event, data);
};

module.exports = {
    initSocket,
    broadcastToUser,
    broadcastToAll
};
