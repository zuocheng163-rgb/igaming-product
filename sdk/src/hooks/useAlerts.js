import { useState, useCallback } from 'react';
import axios from 'axios';
import { getEnv } from '../utils';

export const useAlerts = (playerId, config = {}) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAlerts = useCallback(async () => {
        if (!playerId) return;
        setLoading(true);
        try {
            // In NeoStrike, alerts are often returned in regular API responses, 
            // but we also provide a polling endpoint or a dedicated fetch.
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');
            const response = await axios.get(`${apiUrl}/api/v1/players/alerts`, {
                params: { player_id: playerId },
                headers: {
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1'
                }
            });
            setAlerts(response.data.alerts || []);
            setError(null);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    }, [playerId, config.brandId]);

    const dismiss = useCallback(async (alertId) => {
        try {
            await axios.post(`${process.env.VITE_NEOSTRIKE_API_URL}/api/v1/players/alerts/${alertId}/dismiss`, {
                player_id: playerId
            }, {
                headers: {
                    'x-api-key': process.env.VITE_NEOSTRIKE_API_KEY,
                    'x-brand-id': config.brandId || '1'
                }
            });
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (err) {
            setError(err.response?.data || err.message);
        }
    }, [playerId, config.brandId]);

    return { alerts, dismiss, loading, error, refresh: fetchAlerts };
};
