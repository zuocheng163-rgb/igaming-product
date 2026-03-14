import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useLobbyCarousels = () => {
    const { client } = useNeoStrike();
    const [carousels, setCarousels] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchLobby = useCallback(async () => {
        setLoading(true);
        try {
            const data = await client.getLobbyCuration();
            setCarousels(data.carousels || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch lobby curation', err);
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchLobby();
    }, [fetchLobby]);

    return { carousels, loading, refresh: fetchLobby };
};
