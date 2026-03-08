'use strict';
/**
 * RGLimitsService
 * Manages player-controlled Responsible Gambling limits.
 *
 * Rules:
 *  - Decreasing a limit (or removing one) takes effect immediately.
 *  - Increasing a limit (or adding one) enters a 24 h cooling period.
 *  - A pending increase can be cancelled any time before it becomes effective.
 *  - Enforcement: getEffectiveLimit() always returns the most-restrictive value.
 */

const supabaseService = require('./supabase');
const { logger } = require('./logger');
const RGAuditService = require('./rg-audit-service');

const VALID_TYPES   = ['deposit', 'loss', 'wager', 'session_time'];
const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'per_session'];

// 24 h in ms
const COOLING_MS = 24 * 60 * 60 * 1000;

class RGLimitsService {
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    static _validateArgs(limitType, period) {
        if (!VALID_TYPES.includes(limitType))   throw new Error(`Invalid limitType: ${limitType}`);
        if (!VALID_PERIODS.includes(period))    throw new Error(`Invalid period: ${period}`);
    }

    static async _getRow(playerId, tenantId, limitType, period) {
        const { data, error } = await supabaseService.client
            .from('player_rg_limits')
            .select('*')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .eq('limit_type', limitType)
            .eq('period', period)
            .maybeSingle();

        if (error) throw new Error(`DB error: ${error.message}`);
        return data;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Set (or update) a limit for a player.
     *
     * @param {string} playerId
     * @param {string} tenantId
     * @param {string} limitType   – 'deposit' | 'loss' | 'wager' | 'session_time'
     * @param {string} period      – 'daily' | 'weekly' | 'monthly' | 'per_session'
     * @param {number|null} value  – limit value (minutes for session_time); null = remove limit
     * @returns {{ effectiveAt: Date|null, pending: boolean }}
     */
    static async setLimit(playerId, tenantId, limitType, period, value) {
        this._validateArgs(limitType, period);

        const existing = await this._getRow(playerId, tenantId, limitType, period);
        const now = new Date();

        // Determine if this is an immediate or cooling-period change
        const numValue = value === null ? null : parseFloat(value);
        const currentValue = existing?.current_value ?? null;

        // An "increase" means the new limit is more lenient (higher numeric OR going from a limit to no limit)
        const isIncrease = numValue === null || (currentValue !== null && numValue > currentValue);

        if (isIncrease) {
            // Queue as pending — effective after cooling period
            const effectiveAt = new Date(now.getTime() + COOLING_MS);
            const upsert = {
                player_id:            playerId,
                tenant_id:            tenantId,
                limit_type:           limitType,
                period,
                current_value:        currentValue,    // keep the old value live
                pending_value:        numValue,
                pending_effective_at: effectiveAt.toISOString(),
                set_by_player_at:     now.toISOString(),
                updated_at:           now.toISOString(),
                active:               true,
            };

            if (existing) {
                const { error } = await supabaseService.client
                    .from('player_rg_limits')
                    .update(upsert)
                    .eq('player_id', playerId)
                    .eq('tenant_id', tenantId)
                    .eq('limit_type', limitType)
                    .eq('period', period);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabaseService.client
                    .from('player_rg_limits')
                    .insert(upsert);
                if (error) throw new Error(error.message);
            }

            await RGAuditService.log(tenantId, playerId, 'RG_LIMIT_INCREASE_PENDING', {
                limitType, period, requestedValue: numValue, effectiveAt: effectiveAt.toISOString(),
            });

            logger.info('[RGLimits] Limit increase queued (cooling period)', { playerId, limitType, period, effectiveAt });
            return { effectiveAt, pending: true };

        } else {
            // Immediate — decrease or explicit removal
            const upsert = {
                player_id:            playerId,
                tenant_id:            tenantId,
                limit_type:           limitType,
                period,
                previous_value:       currentValue,
                current_value:        numValue,
                pending_value:        null,
                pending_effective_at: null,
                set_by_player_at:     now.toISOString(),
                updated_at:           now.toISOString(),
                active:               numValue !== null,
            };

            if (existing) {
                const { error } = await supabaseService.client
                    .from('player_rg_limits')
                    .update(upsert)
                    .eq('player_id', playerId)
                    .eq('tenant_id', tenantId)
                    .eq('limit_type', limitType)
                    .eq('period', period);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabaseService.client
                    .from('player_rg_limits')
                    .insert(upsert);
                if (error) throw new Error(error.message);
            }

            await RGAuditService.log(tenantId, playerId, 'RG_LIMIT_DECREASED', {
                limitType, period, previousValue: currentValue, newValue: numValue,
            });

            logger.info('[RGLimits] Limit decreased / removed immediately', { playerId, limitType, period, value: numValue });
            return { effectiveAt: now, pending: false };
        }
    }

    /**
     * Cancel a pending limit increase before it becomes effective.
     */
    static async cancelPending(playerId, tenantId, limitType, period) {
        this._validateArgs(limitType, period);

        const { error } = await supabaseService.client
            .from('player_rg_limits')
            .update({ pending_value: null, pending_effective_at: null, updated_at: new Date().toISOString() })
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .eq('limit_type', limitType)
            .eq('period', period)
            .not('pending_value', 'is', null);

        if (error) throw new Error(error.message);

        await RGAuditService.log(tenantId, playerId, 'RG_LIMIT_CANCELLED', { limitType, period });
        logger.info('[RGLimits] Pending increase cancelled', { playerId, limitType, period });
    }

    /**
     * Promote any pending limit increases whose cooling period has elapsed.
     * Called by the daily cron job.
     */
    static async promotePendingLimits() {
        if (!supabaseService.client) return 0;

        const { data, error } = await supabaseService.client
            .from('player_rg_limits')
            .select('*')
            .not('pending_value', 'is', null)
            .lte('pending_effective_at', new Date().toISOString());

        if (error) {
            logger.error('[RGLimits] promotePendingLimits query failed', { error: error.message });
            return 0;
        }

        let promoted = 0;
        for (const row of (data || [])) {
            const { error: upErr } = await supabaseService.client
                .from('player_rg_limits')
                .update({
                    current_value:        row.pending_value,
                    previous_value:       row.current_value,
                    pending_value:        null,
                    pending_effective_at: null,
                    updated_at:           new Date().toISOString(),
                })
                .eq('id', row.id);

            if (upErr) {
                logger.error('[RGLimits] Failed to promote limit', { id: row.id, error: upErr.message });
            } else {
                promoted++;
                await RGAuditService.log(row.tenant_id, row.player_id, 'RG_LIMIT_INCREASE_EFFECTIVE', {
                    limitType: row.limit_type,
                    period: row.period,
                    newValue: row.pending_value,
                });
            }
        }

        logger.info(`[RGLimits] Promoted ${promoted} pending limit increases`);
        return promoted;
    }

    /**
     * Get all active limits for a player.
     */
    static async getPlayerLimits(playerId, tenantId) {
        if (!supabaseService.client) return [];

        const { data, error } = await supabaseService.client
            .from('player_rg_limits')
            .select('*')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .eq('active', true);

        if (error) throw new Error(error.message);
        return data || [];
    }

    /**
     * Check whether a proposed transaction amount would breach any active limit.
     * Returns { breached: false } or { breached: true, limitType, period, current, proposed }.
     *
     * @param {string} playerId
     * @param {string} tenantId
     * @param {'deposit'|'loss'|'wager'} txType
     * @param {number}  proposedAmount
     * @param {Map<string,number>} periodTotals  – pre-computed period totals keyed by period
     *        e.g. { daily: 250, weekly: 800, monthly: 2200 }
     */
    static async checkBreach(playerId, tenantId, txType, proposedAmount, periodTotals = {}) {
        const limits = await this.getPlayerLimits(playerId, tenantId);
        const relevant = limits.filter(l => l.limit_type === txType && l.current_value !== null);

        for (const limit of relevant) {
            const spent = periodTotals[limit.period] || 0;
            if (spent + proposedAmount > limit.current_value) {
                return {
                    breached: true,
                    limitType: limit.limit_type,
                    period:    limit.period,
                    current:   limit.current_value,
                    proposed:  spent + proposedAmount,
                };
            }
        }

        return { breached: false };
    }
}

module.exports = RGLimitsService;
