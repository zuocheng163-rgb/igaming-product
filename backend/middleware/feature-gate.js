const { logger } = require('../services/logger');

const OFFERING_LEVELS = {
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED'
};

const FEATURES = {
    // Basic features
    CRM: OFFERING_LEVELS.BASIC,
    BACKOFFICE: OFFERING_LEVELS.BASIC,
    COMPLIANCE: OFFERING_LEVELS.BASIC,

    // Advanced features
    BONUSING: OFFERING_LEVELS.ADVANCED,
    GAMES: OFFERING_LEVELS.ADVANCED,
    KYC: OFFERING_LEVELS.ADVANCED,
    PROVIDERS: OFFERING_LEVELS.ADVANCED
};

const getCurrentOffering = () => {
    return (process.env.PRODUCT_OFFERING || OFFERING_LEVELS.BASIC).toUpperCase();
};

const isFeatureEnabled = (featureName) => {
    const requiredLevel = FEATURES[featureName];
    if (!requiredLevel) return true; // Default to enabled if not mapped

    const currentLevel = getCurrentOffering();

    if (currentLevel === OFFERING_LEVELS.ADVANCED) return true;
    return requiredLevel === OFFERING_LEVELS.BASIC;
};

const featureGate = (featureName) => {
    return (req, res, next) => {
        if (isFeatureEnabled(featureName)) {
            next();
        } else {
            logger.warn(`Feature access denied: ${featureName}`, {
                offering: getCurrentOffering(),
                path: req.path
            });
            res.status(403).json({
                error: 'FEATURE_DISABLED',
                message: `This feature requires an Advanced product offering.`
            });
        }
    };
};

module.exports = {
    featureGate,
    isFeatureEnabled,
    getCurrentOffering,
    OFFERING_LEVELS
};
