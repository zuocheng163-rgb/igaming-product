import { useState, useCallback } from 'react';
import axios from 'axios';
import { getEnv, logSDKEvent } from '../utils';

export const usePayments = (playerId, config = {}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const deposit = useCallback(async (amount, method = 'card') => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');

            const response = await axios.post(`${apiUrl}/api/deposit`, {
                user_id: playerId,
                amount,
                method
            }, {
                headers: {
                    'x-brand-id': config.brandId || '1',
                    ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : { 'x-api-key': apiKey })
                }
            });
            setError(null);
            logSDKEvent('PAYMENT', `Deposit of ${amount} ${method} successful`, { transactionId: response.data.transaction_id });
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            logSDKEvent('ERROR', `Deposit failed: ${msg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [playerId, config.brandId]);

    const withdraw = useCallback(async (amount, method = 'card') => {
        setLoading(true);
        try {
            const response = await axios.post(`${process.env.VITE_NEOSTRIKE_API_URL}/api/withdraw`, {
                user_id: playerId,
                amount,
                method
            }, {
                headers: {
                    'x-api-key': process.env.VITE_NEOSTRIKE_API_KEY,
                    'x-brand-id': config.brandId || '1'
                }
            });
            setError(null);
            return response.data;
        } catch (err) {
            setError(err.response?.data || err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [playerId, config.brandId]);

    const getMethods = useCallback(async (type) => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const response = await axios.get(`${apiUrl}/api/v1/payments/methods`, {
                params: { type },
                headers: { 'x-brand-id': config.brandId || '1' }
            });
            return response.data.methods || [];
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch payment methods', err);
            return []; // Fallback
        } finally {
            setLoading(false);
        }
    }, [config.brandId]);

    const submitPayment = useCallback(async (details) => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const response = await axios.post(`${apiUrl}/api/v1/payments/submit`, {
                ...details,
                user_id: playerId
            }, {
                headers: {
                    'x-brand-id': config.brandId || '1',
                    ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
                }
            });
            return { success: true, ...response.data };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || err.message };
        } finally {
            setLoading(false);
        }
    }, [playerId, config.brandId, config.token]);

    return { deposit, withdraw, getMethods, submitPayment, loading, error };
};
