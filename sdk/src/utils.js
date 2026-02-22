export const getEnv = (key) => {
    // Vite / ESM
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env[key]) return import.meta.env[key];
    }
    // Node / Webpack
    if (typeof process !== 'undefined' && process.env) {
        if (process.env[key]) return process.env[key];
    }
    return undefined;
};

// Simple Event Bus for SDK Observation
const listeners = new Set();

export const subscribeToSDK = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

export const logSDKEvent = (type, message, data = null) => {
    const event = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type,
        message,
        data
    };
    listeners.forEach(cb => cb(event));
    console.log(`[NeoStrike SDK] ${type}: ${message}`, data || '');
};

