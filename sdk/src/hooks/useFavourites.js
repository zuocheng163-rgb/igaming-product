import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useFavourites = () => {
    const { client } = useNeoStrike();
    const [favourites, setFavourites] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchFavourites = useCallback(async () => {
        setLoading(true);
        try {
            const data = await client.getFavourites();
            setFavourites(data.games || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch favourites', err);
            const local = localStorage.getItem('ns_favourites');
            if (local) setFavourites(JSON.parse(local));
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchFavourites();
    }, [fetchFavourites]);

    const toggleFavourite = async (gameId) => {
        try {
            const data = await client.toggleFavourite(gameId);
            fetchFavourites();
            return data.is_favourite;
        } catch (err) {
            console.error('[NeoStrike SDK] Toggle favourite failed', err);
        }
    };

    const isFavourite = (gameId) => favourites.some(g => g.id === gameId);

    return { favourites, loading, toggleFavourite, isFavourite, refresh: fetchFavourites };
};
