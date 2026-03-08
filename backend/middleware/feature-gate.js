const { logger } = require('../services/logger');
let supabaseService; // Lazy load to avoid circular dependency

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

// Fallback to ENV if DB fails or is empty
const getCurrentOfferingFromEnv = () => {
    return (process.env.PRODUCT_OFFERING || OFFERING_LEVELS.BASIC).toUpperCase();
};

const isFeatureEnabled = async (featureName, brandId = 1) => {
    const requiredLevel = FEATURES[featureName];
    if (!requiredLevel) return true; // Default to enabled if not mapped

    // Try to get from Database first
    if (!supabaseService) {
        supabaseService = require('../services/supabase');
    }

    let currentLevel = getCurrentOfferingFromEnv();
    try {
        const config = await supabaseService.getTenantConfig(brandId);
        if (config?.product_tier) {
            currentLevel = config.product_tier.toUpperCase();
        }
    } catch (err) {
        logger.warn('[FeatureGate] Failed to fetch DB config, falling back to ENV', { brandId, error: err.message });
    }

    if (currentLevel === OFFERING_LEVELS.ADVANCED) return true;
    return requiredLevel === OFFERING_LEVELS.BASIC;
};

const featureGate = (featureName) => {
    return async (req, res, next) => {
        const brandId = req.brandId || req.user?.brand_id || 1;
        const enabled = await isFeatureEnabled(featureName, brandId);
        
        if (enabled) {
            next();
        } else {
            logger.warn(`Feature access denied: ${featureName}`, {
                brandId,
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
    OFFERING_LEVELS
};
