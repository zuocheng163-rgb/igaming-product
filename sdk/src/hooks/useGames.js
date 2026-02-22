import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getEnv } from '../utils';

export const useGames = (config = {}) => {
    const [games, setGames] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        provider: config.provider || '',
        category: config.category || '',
        search: '',
        page: 1,
        limit: config.limit || 50
    });

    const fetchGames = useCallback(async () => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');

            const response = await axios.get(`${apiUrl}/api/v1/games/catalog`, {
                params: filters,
                headers: {
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1'
                }
            });

            if (filters.page === 1) {
                setGames(response.data.games);
            } else {
                setGames(prev => [...prev, ...response.data.games]);
            }
            setTotal(response.data.total);
            setError(null);
        } catch (err) {
            setError(err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    }, [filters, config.brandId]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    const search = (term) => setFilters(prev => ({ ...prev, search: term, page: 1 }));
    const filter = (newFilters) => setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
    const loadMore = () => setFilters(prev => ({ ...prev, page: prev.page + 1 }));

    return { games, total, loading, error, search, filter, loadMore, refresh: fetchGames };
};
