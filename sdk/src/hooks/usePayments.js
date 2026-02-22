import { useState, useCallback } from 'react';
import axios from 'axios';

export const usePayments = (playerId, config = {}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const deposit = useCallback(async (amount, method = 'card') => {
        setLoading(true);
        try {
            const response = await axios.post(`${process.env.VITE_NEOSTRIKE_API_URL}/api/deposit`, {
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
