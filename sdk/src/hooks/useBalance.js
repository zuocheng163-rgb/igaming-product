import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getEnv } from '../utils';

export const useBalance = (playerId, config = {}) => {
    const [balance, setBalance] = useState(0);
    const [bonusBalance, setBonusBalance] = useState(0);
    const [currency, setCurrency] = useState('EUR');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchBalance = useCallback(async () => {
        if (!playerId) return;
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');

            const response = await axios.get(`${apiUrl}/api/balance`, {
                params: { user_id: playerId },
                headers: {
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1'
                }
            });
            setBalance(response.data.balance || response.data.amount);
            setBonusBalance(response.data.bonus_balance || response.data.bonus_amount || 0);
            setCurrency(response.data.currency || 'EUR');
            setError(null);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    }, [playerId, config.brandId]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    const refresh = () => fetchBalance();

    return { balance, bonusBalance, currency, loading, error, refresh };
};
