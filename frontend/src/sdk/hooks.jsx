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
    // Alerts are harder with polling. For now, we'll just leave it as a placeholder
    // In a real serverless app, we'd use Server-Sent Events (SSE) or long-polling
    // if we really needed push notifications.
    // For this migration, we'll return empty.

    return { lastAlert: null, clearAlert: () => { } };
};
