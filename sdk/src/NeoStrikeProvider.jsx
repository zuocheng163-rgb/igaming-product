import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { NeoStrikeClient } from './NeoStrikeClient';

const NeoStrikeContext = createContext(null);

export const NeoStrikeProvider = ({ children, config }) => {
    const [balance, setBalance] = useState(0);
    const [bonusBalance, setBonusBalance] = useState(0);
    const [alerts, setAlerts] = useState([]);

    const client = useMemo(() => new NeoStrikeClient(config), [config]);

    const updateBalance = (newBalance, newBonus) => {
        if (newBalance !== undefined) setBalance(newBalance);
        if (newBonus !== undefined) setBonusBalance(newBonus);
    };

    const pollBalance = async () => {
        if (!config.token) return;
        try {
            const data = await client.getBalance();
            setBalance(data.balance || data.amount);
            setBonusBalance(data.bonus_balance || data.bonus_amount || 0);
        } catch (err) {
            console.error('[NeoStrike SDK] Balance poll failed', err);
        }
    };

    useEffect(() => {
        pollBalance();
        const interval = setInterval(pollBalance, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [client]);

    const value = {
        client,
        balance,
        bonusBalance,
        alerts,
        updateBalance,
        pollBalance
    };

    return (
        <NeoStrikeContext.Provider value={value}>
            {children}
        </NeoStrikeContext.Provider>
    );
};

export const useNeoStrike = () => {
    const context = useContext(NeoStrikeContext);
    if (!context) {
        throw new Error('useNeoStrike must be used within a NeoStrikeProvider');
    }
    return context;
};
