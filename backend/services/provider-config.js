const supabaseService = require('./supabase');
const { logger } = require('./logger');

/**
 * ProviderConfigService
 * Manages operator-provider relationships and credentials.
 */
class ProviderConfigService {

    /**
     * Get provider configuration for an operator
     * @param {string} operatorId 
     * @param {string} providerSlug (evolution, pragmatic, etc.)
     */
    static async getConfig(operatorId, providerSlug) {
        try {
            const { data, error } = await supabaseService.client
                .from('operator_providers')
                .select('*')
                .eq('operator_id', operatorId)
                .eq('provider_slug', providerSlug)
                .single();

            if (error || !data) {
                logger.warn(`Provider config not found`, { operatorId, providerSlug });
                return null;
            }

            return data;
        } catch (err) {
            logger.error(`Error fetching provider config`, { err: err.message });
            return null;
        }
    }

    /**
     * Enable or disable a provider for an operator
     */
    static async setStatus(operatorId, providerSlug, isActive) {
        const { error } = await supabaseService.client
            .from('operator_providers')
            .update({ is_active: isActive, updated_at: new Date() })
            .eq('operator_id', operatorId)
            .eq('provider_slug', providerSlug);

        if (error) throw error;
        logger.info(`Provider status updated`, { operatorId, providerSlug, isActive });
    }

    /**
     * Upsert provider credentials
     */
    static async saveCredentials(operatorId, providerSlug, credentials) {
        // In production, credentials should be encrypted before storage
        const { error } = await supabaseService.client
            .from('operator_providers')
            .upsert({
                operator_id: operatorId,
                provider_slug: providerSlug,
                credentials: credentials,
                is_active: true,
                updated_at: new Date()
            });

        if (error) throw error;
        logger.info(`Provider credentials saved`, { operatorId, providerSlug });
    }

    /**
     * Check health of all providers for an operator
     */
    static async healthCheck(operatorId) {
        const { data, error } = await supabaseService.client
            .from('operator_providers')
            .select('provider_slug, is_active, last_success_at')
            .eq('operator_id', operatorId);

        if (error) throw error;
        return data.map(p => ({
            provider: p.provider_slug,
            status: p.is_active ? 'HEALTHY' : 'DISABLED',
            lastSync: p.last_success_at
        }));
    }
}

module.exports = ProviderConfigService;
