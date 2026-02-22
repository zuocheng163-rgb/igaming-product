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
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1'
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

    return { deposit, withdraw, loading, error };
};
