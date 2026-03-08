'use strict';
/**
 * RGAuditService
 * Append-only audit trail for all Responsible Gambling events.
 * DB rules prevent UPDATE/DELETE so this log is tamper-resistant.
 */

const supabaseService = require('./supabase');
const { logger } = require('./logger');

const VALID_EVENT_TYPES = new Set([
    'RG_LIMIT_DECREASED',
    'RG_LIMIT_INCREASE_PENDING',
    'RG_LIMIT_INCREASE_EFFECTIVE',
    'RG_LIMIT_CANCELLED',
    'RG_SELF_EXCLUSION_APPLIED',
    'RG_GAMSTOP_BLOCK',
    'RG_HARM_SIGNAL_DETECTED',
    'RG_REALITY_CHECK_SENT',
    'RG_MANDATORY_BREAK_TRIGGERED',
    'RG_WELFARE_CHECK_SENT',
    'RG_BONUS_SUPPRESSED',
    'RG_EDD_PENDING_SET',
]);

class RGAuditService {
    /**
     * Append a single RG audit event.
     * @param {string} tenantId
     * @param {string} playerId
     * @param {string} eventType  - must be one of VALID_EVENT_TYPES
     * @param {object} payload    - arbitrary JSON details
     */
    static async log(tenantId, playerId, eventType, payload = {}) {
        if (!VALID_EVENT_TYPES.has(eventType)) {
            logger.error('[RGAudit] Unknown event type — skipping', { eventType });
            return;
        }

        if (!supabaseService.client) {
            logger.warn('[RGAudit] No DB client — audit event not persisted', { eventType, playerId });
            return;
        }

        const { error } = await supabaseService.client
            .from('rg_audit_log')
            .insert({ tenant_id: tenantId, player_id: playerId, event_type: eventType, payload });

        if (error) {
            logger.error('[RGAudit] Failed to persist audit event', { error: error.message, eventType, playerId });
        } else {
            logger.info('[RGAudit] Event logged', { eventType, playerId, tenantId });
        }
    }

    /**
     * Query audit events for a player (reverse chronological).
     * @param {string} tenantId
     * @param {string} playerId
     * @param {object} opts  - { limit, eventType, sinceDate }
     */
    static async getPlayerHistory(tenantId, playerId, { limit = 50, eventType, sinceDate } = {}) {
        if (!supabaseService.client) return [];

        let query = supabaseService.client
            .from('rg_audit_log')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('player_id', playerId)
            .order('occurred_at', { ascending: false })
            .limit(limit);

        if (eventType) query = query.eq('event_type', eventType);
        if (sinceDate) query = query.gte('occurred_at', sinceDate);

        const { data, error } = await query;
        if (error) {
            logger.error('[RGAudit] Query failed', { error: error.message });
            return [];
        }
        return data || [];
    }
}

module.exports = RGAuditService;
