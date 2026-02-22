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
