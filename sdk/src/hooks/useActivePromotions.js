import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useActivePromotions = () => {
    const { client } = useNeoStrike();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await client.getActivePromotions();
            setPromotions(data.promotions || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch promotions', err);
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchPromotions();
    }, [fetchPromotions]);

    return { promotions, loading, refresh: fetchPromotions };
};
