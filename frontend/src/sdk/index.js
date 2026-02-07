import { io } from 'socket.io-client';

class NeoStrikeClient {
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:5000';
        this.wsUrl = config.wsUrl || 'ws://localhost:5000';
        this.token = config.token;
        this.socket = null;
        this.eventHandlers = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = io(this.wsUrl, {
                auth: {
                    token: this.token,
                    sandbox: true // Explicitly send sandbox flag in auth payload
                },
                extraHeaders: {
                    'x-sandbox-mode': 'true'
                },
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000
            });

            this.socket.on('connect', () => {
                console.log('NeoStrike WebSocket Connected');
                resolve(this.socket);
            });

            this.socket.on('connect_error', (error) => {
                console.error('NeoStrike WebSocket connection error:', error.message);
                reject(error);
            });

            this.socket.on('disconnect', (reason) => {
                console.warn('NeoStrike WebSocket disconnected:', reason);
            });

            // Direct event proxy to mapped handlers
            this.socket.onAny((event, ...args) => {
                if (this.eventHandlers.has(event)) {
                    this.eventHandlers.get(event).forEach(handler => handler(...args));
                }
            });
        });
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

export { NeoStrikeClient };
