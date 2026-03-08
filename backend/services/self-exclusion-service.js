'use strict';
/**
 * SelfExclusionService
 * Manages self-exclusion and GAMSTOP integration.
 *
 * GAMSTOP is double-gated:
 *   1. tenant_configs.gamstop_enabled must be TRUE
 *   2. process.env.GAMSTOP_API_KEY must be non-empty
 *
 * If either gate is false, all GAMSTOP operations silently no-op.
 */

const https   = require('https');
const supabaseService = require('./supabase');
const { logger }      = require('./logger');
const RGAuditService  = require('./rg-audit-service');

const GAMSTOP_API_URL  = 'https://api.gamstop.co.uk/api/v1/player/check';
const GAMSTOP_TIMEOUT  = 5000; // ms

class SelfExclusionService {
    // -------------------------------------------------------------------------
    // GAMSTOP gate  (both conditions must be true)
    // -------------------------------------------------------------------------

    /**
     * Returns true only when GAMSTOP is fully configured and enabled for this tenant.
     * @param {string|number} tenantId
     */
    static async isGAMSTOPEnabled(tenantId) {
        // Gate 2: backend must have the API key OR mock mode active
        if (!process.env.GAMSTOP_API_KEY && process.env.GAMSTOP_MOCK_MODE !== 'true') return false;

        // Gate 1: operator must have toggled it on for this tenant
        const cfg = await supabaseService.getTenantConfig(tenantId).catch(() => null);
        return cfg?.gamstop_enabled === true;
    }

    // -------------------------------------------------------------------------
    // GAMSTOP API call
    // -------------------------------------------------------------------------

    /**
     * Call the GAMSTOP REST API. Returns 'EXCLUDED' | 'NOT_EXCLUDED' | 'UNKNOWN'.
     * Silently returns 'NOT_EXCLUDED' (with a warning log) when GAMSTOP is not enabled.
     *
     * @param {string} email
     * @param {string|number} tenantId
     */
    static async checkGAMSTOP(email, tenantId) {
        const enabled = await this.isGAMSTOPEnabled(tenantId);
        if (!enabled) {
            logger.debug('[SelfExclusion] GAMSTOP not enabled for tenant — skipping check', { tenantId });
            return 'NOT_EXCLUDED';
        }

        // Mock Mode Implementation
        if (process.env.GAMSTOP_MOCK_MODE === 'true') {
            const mockEmail = (email || '').toLowerCase().trim();
            logger.info('[SelfExclusion] GAMSTOP Mock Mode Active', { email: mockEmail });
            
            if (mockEmail === 'excluded@test.com') return 'EXCLUDED';
            if (mockEmail === 'error@test.com') return 'SERVICE_UNAVAILABLE';
            if (mockEmail === 'partial@test.com') return 'PARTIAL_MATCH';
            return 'NOT_EXCLUDED';
        }

        return new Promise((resolve) => {
            const body = JSON.stringify({ email });
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${process.env.GAMSTOP_API_KEY}`,
                    'Content-Length': Buffer.byteLength(body),
                },
                timeout: GAMSTOP_TIMEOUT,
            };

            // Use the GAMSTOP API URL (URL parsing for host/path)
            const url = new URL(GAMSTOP_API_URL);
            options.hostname = url.hostname;
            options.path     = url.pathname;
            options.port     = 443;

            const req = https.request(options, (res) => {
                let raw = '';
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(raw);
                        const status = json?.exclusionStatus || json?.status || 'UNKNOWN';
                        resolve(status.toUpperCase());
                    } catch {
                        logger.warn('[SelfExclusion] GAMSTOP response parse error', { raw });
                        resolve('UNKNOWN');
                    }
                });
            });

            req.on('error',   (err) => { logger.error('[SelfExclusion] GAMSTOP request error', { error: err.message }); resolve('UNKNOWN'); });
            req.on('timeout', ()    => { logger.warn('[SelfExclusion] GAMSTOP request timeout');  req.destroy(); resolve('UNKNOWN'); });

            req.write(body);
            req.end();
        });
    }

    // -------------------------------------------------------------------------
    // Self-exclusion management
    // -------------------------------------------------------------------------

    /**
     * Apply a self-exclusion to a player.
     *
     * @param {string} playerId
     * @param {string|number} tenantId
     * @param {'temporary'|'permanent'|'gamstop'} type
     * @param {number|null} durationDays  – required for 'temporary'; null for permanent/gamstop
     */
    static async selfExclude(playerId, tenantId, type, durationDays = null) {
        if (!['temporary', 'permanent', 'gamstop'].includes(type)) {
            throw new Error(`Invalid exclusion type: ${type}`);
        }

        const now = new Date();
        let exclusionUntil = null;

        if (type === 'temporary') {
            if (!durationDays || durationDays < 1) throw new Error('durationDays required for temporary exclusion');
            exclusionUntil = new Date(now.getTime() + durationDays * 86400_000).toISOString();
        }

        const { error } = await supabaseService.client
            .from('player_profiles')
            .update({
                self_exclusion_type:  type,
                self_exclusion_until: exclusionUntil,
            })
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId);

        if (error) throw new Error(`DB error applying self-exclusion: ${error.message}`);

        await RGAuditService.log(tenantId, playerId, 'RG_SELF_EXCLUSION_APPLIED', {
            type,
            durationDays,
            exclusionUntil,
        });

        logger.info('[SelfExclusion] Self-exclusion applied', { playerId, tenantId, type, exclusionUntil });
    }

    /**
     * Mark a player as GAMSTOP-blocked in the database and log it.
     * Only called when checkGAMSTOP returns 'EXCLUDED'.
     */
    static async applyGAMSTOPBlock(playerId, tenantId) {
        const { error } = await supabaseService.client
            .from('player_profiles')
            .update({ gamstop_blocked: true, self_exclusion_type: 'gamstop', self_exclusion_until: null })
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId);

        if (error) throw new Error(`DB error applying GAMSTOP block: ${error.message}`);

        await RGAuditService.log(tenantId, playerId, 'RG_GAMSTOP_BLOCK', { source: 'api_check' });
        logger.warn('[SelfExclusion] GAMSTOP block applied', { playerId, tenantId });
    }

    // -------------------------------------------------------------------------
    // Exclusion status check (fast path from DB)
    // -------------------------------------------------------------------------

    /**
     * Check if a player is currently excluded (any type).
     * Returns { excluded: boolean, reason: string|null }
     */
    static async isExcluded(playerId, tenantId) {
        const { data, error } = await supabaseService.client
            .from('player_profiles')
            .select('self_exclusion_type, self_exclusion_until, gamstop_blocked')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (error || !data) return { excluded: false, reason: null };

        // GAMSTOP block — always excluded regardless of until date
        if (data.gamstop_blocked) return { excluded: true, reason: 'gamstop' };

        if (data.self_exclusion_type === 'permanent') return { excluded: true, reason: 'permanent' };

        if (data.self_exclusion_type === 'temporary' && data.self_exclusion_until) {
            if (new Date(data.self_exclusion_until) > new Date()) {
                return { excluded: true, reason: 'temporary' };
            }
        }

        return { excluded: false, reason: null };
    }

    // -------------------------------------------------------------------------
    // Daily GAMSTOP sync job
    // -------------------------------------------------------------------------

    /**
     * Batch-check all non-blocked players for this tenant against GAMSTOP.
     * Skips entirely when GAMSTOP is not enabled for the tenant.
     *
     * @param {string|number} tenantId
     * @returns {number} count of newly blocked players
     */
    static async dailyGAMSTOPSync(tenantId) {
        const enabled = await this.isGAMSTOPEnabled(tenantId);
        if (!enabled) {
            logger.debug('[SelfExclusion] GAMSTOP not enabled — skipping daily sync', { tenantId });
            return 0;
        }

        const { data: players, error } = await supabaseService.client
            .from('player_profiles')
            .select('player_id, email')
            .eq('tenant_id', tenantId)
            .eq('gamstop_blocked', false)
            .not('self_exclusion_type', 'eq', 'permanent');

        if (error) {
            logger.error('[SelfExclusion] dailyGAMSTOPSync player query failed', { error: error.message, tenantId });
            return 0;
        }

        let blocked = 0;
        for (const player of (players || [])) {
            if (!player.email) continue;
            const status = await this.checkGAMSTOP(player.email, tenantId);
            if (status === 'EXCLUDED') {
                await this.applyGAMSTOPBlock(player.player_id, tenantId).catch((err) =>
                    logger.error('[SelfExclusion] Failed to apply GAMSTOP block', { error: err.message, playerId: player.player_id })
                );
                blocked++;
            }
            // Throttle to stay within GAMSTOP rate limits
            await new Promise(r => setTimeout(r, 100));
        }

        logger.info(`[SelfExclusion] Daily GAMSTOP sync complete`, { tenantId, blocked, checked: players?.length || 0 });
        return blocked;
    }
}

module.exports = SelfExclusionService;
