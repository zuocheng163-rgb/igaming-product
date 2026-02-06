import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { NeoStrikeClient } from './index';

const NeoStrikeContext = createContext(null);

export const NeoStrikeProvider = ({ config, children }) => {
    const [client, setClient] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
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
    }, [config.token, config.wsUrl]);

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

        const handleBalanceUpdate = (data) => {
            console.log('Real-time balance update received:', data);
            if (data.balance !== undefined) setBalance(data.balance);
            if (data.bonus_balance !== undefined) setBonusBalance(data.bonus_balance);
        };

        client.on('balance_update', handleBalanceUpdate);

        return () => {
            client.off('balance_update', handleBalanceUpdate);
        };
    }, [client, isConnected]);

    return { balance, bonusBalance };
};

export const useAlerts = () => {
    const { client, isConnected } = useWebSocket();
    const [lastAlert, setLastAlert] = useState(null);

    useEffect(() => {
        if (!client || !isConnected) return;

        const handleRgAlert = (data) => {
            console.warn('Responsible Gaming Alert:', data);
            setLastAlert(data);
        };

        const handleBonusAwarded = (data) => {
            console.log('Bonus Awarded:', data);
            setLastAlert({ type: 'bonus', ...data });
        };

        client.on('rg_alert', handleRgAlert);
        client.on('bonus_awarded', handleBonusAwarded);

        return () => {
            client.off('rg_alert', handleRgAlert);
            client.off('bonus_awarded', handleBonusAwarded);
        };
    }, [client, isConnected]);

    return { lastAlert, clearAlert: () => setLastAlert(null) };
};
