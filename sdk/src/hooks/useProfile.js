import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useProfile = () => {
    const { client } = useNeoStrike();
    const [kycStatus, setKycStatus] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchProfileData = useCallback(async () => {
        setLoading(true);
        try {
            const [kyc, tx] = await Promise.all([
                client.getKycStatus(),
                client.getTransactions()
            ]);
            setKycStatus(kyc);
            setTransactions(tx.transactions || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch profile details', err);
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    const deleteAccount = async () => {
        return await client.deleteAccount();
    };

    const updateConsents = async (consents) => {
        return await client.updateConsents(consents);
    };

    return { kycStatus, transactions, loading, deleteAccount, updateConsents, refresh: fetchProfileData };
};
