import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useRecentlyPlayed = () => {
    const { client } = useNeoStrike();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchRecentlyPlayed = useCallback(async () => {
        setLoading(true);
        try {
            const data = await client.getRecentlyPlayed();
            setGames(data.games || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch recently played', err);
            // Fallback to local storage if needed
            const local = localStorage.getItem('ns_recently_played');
            if (local) setGames(JSON.parse(local));
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchRecentlyPlayed();
    }, [fetchRecentlyPlayed]);

    return { games, loading, refresh: fetchRecentlyPlayed };
};
