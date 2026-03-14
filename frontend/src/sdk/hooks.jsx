import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { NeoStrikeClient } from './index';

const NeoStrikeContext = createContext(null);

export const NeoStrikeProvider = ({ config, children }) => {
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!config.token) {
            console.log('[NeoStrikeProvider] No token provided, skipping initialization.');
            return;
        }

        const neostrike = new NeoStrikeClient(config);

        const initialize = async () => {
            try {
                await neostrike.connect();
                setClient(neostrike);
                setIsConnected(true);
            } catch (err) {
                console.error('Failed to initialize NeoStrike Client', err);
            }
        };

        initialize();

        return () => {
            neostrike.disconnect();
        };
    }, [config.token, config.apiUrl]);

    return (
        <NeoStrikeContext.Provider value={{ client, isConnected }}>
            {children}
        </NeoStrikeContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(NeoStrikeContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a NeoStrikeProvider');
    }
    return context;
};

export const useBalance = (initialBalance = 0) => {
    const { client, isConnected } = useWebSocket();
    const [balance, setBalance] = useState(initialBalance);
    const [bonusBalance, setBonusBalance] = useState(0);

    useEffect(() => {
        if (!client || !isConnected) return;

        // Initial fetch
        const fetchBalance = async () => {
            try {
                const data = await client.connect(); // Re-using connect as a fetcher
                if (data.balance !== undefined) setBalance(data.balance);
                if (data.bonus_balance !== undefined) setBonusBalance(data.bonus_balance);
            } catch (err) {
                console.error('Failed to fetch balance', err);
            }
        };

        fetchBalance();

        // Poll every 5 seconds for updates (Serverless fallback)
        const interval = setInterval(fetchBalance, 5000);

        return () => clearInterval(interval);
    }, [client, isConnected]);

    // Helper to manually update state (optimistic UI)
    const updateBalance = (newBalance, newBonus) => {
        if (newBalance !== undefined) setBalance(newBalance);
        if (newBonus !== undefined) setBonusBalance(newBonus);
    };

    return { balance, bonusBalance, updateBalance };
};

export const useAlerts = () => {
    const { client, isConnected } = useWebSocket();
    const [lastAlert, setLastAlert] = useState(null);
    const seenAlerts = useRef(new Set());

    useEffect(() => {
        if (!client || !isConnected) return;

        const checkAlerts = async () => {
            try {
                const data = await client.getAlerts();
                if (data && data.alert) {
                    const alertKey = `${data.alert.type}-${data.alert.reason}`;
                    if (!seenAlerts.current.has(alertKey)) {
                        setLastAlert(data.alert);
                        seenAlerts.current.add(alertKey);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch player alerts', err);
            }
        };

        checkAlerts();
        const interval = setInterval(checkAlerts, 6000); // Poll every 6s

        return () => clearInterval(interval);
    }, [client, isConnected]);

    const clearAlert = () => setLastAlert(null);

    return { lastAlert, clearAlert };
};

export const useGameFilters = (config = {}) => {
    const { client, isConnected } = useWebSocket();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        category: 'all',
        provider: '',
        page: 1,
        limit: config.limit || 50
    });

    const fetchGames = useCallback(async () => {
        if (!client || !isConnected) return;
        setLoading(true);
        try {
            const data = await client.getGameCatalog(filters);
            setGames(data.games || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to fetch games');
        } finally {
            setLoading(false);
        }
    }, [client, isConnected, filters]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    const setSearch = (search) => setFilters(f => ({ ...f, search, page: 1 }));
    const setCategory = (category) => setFilters(f => ({ ...f, category, page: 1 }));
    const setProvider = (provider) => setFilters(f => ({ ...f, provider, page: 1 }));
    const loadMore = () => setFilters(f => ({ ...f, page: f.page + 1 }));

    return { 
        games, 
        loading, 
        error, 
        filters, 
        setSearch, 
        setCategory, 
        setProvider, 
        loadMore,
        refresh: fetchGames 
    };
};

export const useRecentlyPlayed = () => {
    const { client, isConnected } = useWebSocket();
    const [games, setGames] = useState(() => {
        const saved = localStorage.getItem('ns_recently_played');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        if (!client || !isConnected) return;
        const fetchRecent = async () => {
            try {
                const data = await client.getRecentlyPlayed();
                if (data.games) {
                    setGames(data.games);
                    localStorage.setItem('ns_recently_played', JSON.stringify(data.games));
                }
            } catch (err) {
                console.warn('Failed to fetch recently played from backend', err);
            }
        };
        fetchRecent();
    }, [client, isConnected]);

    return { games };
};

export const useFavourites = () => {
    const { client, isConnected } = useWebSocket();
    const [games, setGames] = useState(() => {
        const saved = localStorage.getItem('ns_favourites');
        return saved ? JSON.parse(saved) : [];
    });

    const isFavourite = (gameId) => games.some(g => g.id === gameId);

    const toggleFavourite = async (gameId) => {
        if (!client || !isConnected) return;
        try {
            const { is_favourite } = await client.toggleFavourite(gameId);
            const updated = await client.getFavourites();
            setGames(updated.games || []);
            localStorage.setItem('ns_favourites', JSON.stringify(updated.games || []));
            return is_favourite;
        } catch (err) {
            console.error('Failed to toggle favourite', err);
        }
    };

    useEffect(() => {
        if (!client || !isConnected) return;
        const fetchFavourites = async () => {
            try {
                const data = await client.getFavourites();
                if (data.games) {
                    setGames(data.games);
                    localStorage.setItem('ns_favourites', JSON.stringify(data.games));
                }
            } catch (err) {
                console.warn('Failed to fetch favourites from backend', err);
            }
        };
        fetchFavourites();
    }, [client, isConnected]);

    return { games, toggleFavourite, isFavourite };
};

export const usePayments = () => {
    const { client, isConnected } = useWebSocket();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getMethods = async (type) => {
        if (!client || !isConnected) return [];
        setLoading(true);
        try {
            const data = await client.getPaymentMethods(type);
            return data.methods || [];
        } catch (err) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const submitPayment = async (data) => {
        if (!client || !isConnected) return { success: false };
        setLoading(true);
        try {
            const result = await client.processPayment(data);
            return result;
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, getMethods, submitPayment };
};

export const useActivePromotions = () => {
    const { client, isConnected } = useWebSocket();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!client || !isConnected) return;
        const fetchPromos = async () => {
            setLoading(true);
            try {
                const data = await client.getActivePromotions();
                setPromotions(data.promotions || []);
            } catch (err) {
                console.warn('Failed to fetch promotions');
            } finally {
                setLoading(false);
            }
        };
        fetchPromos();
    }, [client, isConnected]);

    const getPromosForGame = (gameId) => {
        return promotions.filter(p => !p.game_ids || p.game_ids.includes(gameId));
    };

    return { promotions, loading, getPromosForGame };
};

export const useLobbyCarousels = () => {
    const { client, isConnected } = useWebSocket();
    const [carousels, setCarousels] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!client || !isConnected) return;
        const fetchCuration = async () => {
            setLoading(true);
            try {
                const data = await client.getLobbyCuration();
                setCarousels(data.carousels || []);
            } catch (err) {
                console.warn('Failed to fetch lobby curation');
            } finally {
                setLoading(false);
            }
        };
        fetchCuration();
    }, [client, isConnected]);

    return { carousels, loading };
};

export const useProfile = () => {
    const { client, isConnected } = useWebSocket();
    const [loading, setLoading] = useState(false);
    const [kycStatus, setKycStatus] = useState(null);
    const [transactions, setTransactions] = useState([]);

    const fetchKyc = async () => {
        if (!client || !isConnected) return;
        try {
            const data = await client.getKycStatus();
            setKycStatus(data);
        } catch (err) {
            console.warn('Failed to fetch KYC status');
        }
    };

    const fetchTransactions = async () => {
        if (!client || !isConnected) return;
        setLoading(true);
        try {
            const data = await client.getTransactions();
            setTransactions(data.transactions || []);
        } catch (err) {
            console.warn('Failed to fetch transactions');
        } finally {
            setLoading(false);
        }
    };

    const requestErasure = async () => {
        if (!client || !isConnected) return { success: false };
        try {
            return await client.deleteAccount();
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return { loading, kycStatus, transactions, fetchKyc, fetchTransactions, requestErasure };
};
