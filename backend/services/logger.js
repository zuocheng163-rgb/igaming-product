const winston = require('winston');
const crypto = require('crypto');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'igaming-gateway' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
    ],
});

let dbLogHook = null;

const setDbLogHook = (hook) => {
    dbLogHook = hook;
};

/**
 * Enhanced log function that includes correlation ID and 
 * prepares data for the audit log table.
 */
const auditLog = async (data) => {
    const correlationId = data.correlationId || crypto.randomUUID();
    const logEntry = {
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        level: data.level || 'info',
        actor_id: data.actor_id || 'system',
        action: data.action || 'UNKNOWN_ACTION',
        entity_type: data.entity_type || 'system',
        entity_id: data.entity_id || null,
        metadata: data.metadata || {},
        status: data.status || 'success',
        operator_id: data.operatorId || data.operator_id || 'default',
        message: data.message || data.action
    };

    // Log to winston
    logger.log(logEntry.level, logEntry.message, {
        correlationId,
        ...logEntry.metadata
    });

    // Log to DB if hook is set
    if (dbLogHook && typeof dbLogHook === 'function') {
        dbLogHook(logEntry).catch(err => {
            console.error('[Logger] Failed to persist audit log to DB:', err.message);
        });
    }

    return logEntry;
};

module.exports = {
    logger,
    auditLog,
    setDbLogHook,
    generateCorrelationId: () => crypto.randomUUID()
};
