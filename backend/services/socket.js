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

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        jwt.verify(token, process.env.JWT_SECRET || 'neostrike-local-secret-key-123', (err, decoded) => {
            if (err) {
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
