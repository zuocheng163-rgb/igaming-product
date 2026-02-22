import React, { useState } from 'react';
import { useBalance, usePayments, useSession } from '@neostrike/sdk';
import theme from '../../theme.config';

export const WalletDrawer = ({ isOpen, onClose }) => {
    const { player } = useSession();
    const { balance, bonusBalance, currency, refresh } = useBalance(player?.user_id);
    const { deposit, withdraw, loading } = usePayments(player?.user_id);
    const [amount, setAmount] = useState('10');

    if (!isOpen) return null;

    const handleDeposit = async () => {
        try {
            await deposit(parseFloat(amount));
            refresh();
            alert('Deposit successful!');
        } catch (err) {
            alert('Deposit failed');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '300px',
            height: '100%',
            background: theme.colors.surface,
            boxShadow: '-2px 0 10px rgba(0,0,0,0.5)',
            padding: '20px',
            color: theme.colors.text,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <h2 style={{ margin: 0 }}>Wallet</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>Real Balance</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{currency} {balance.toFixed(2)}</div>

                <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>Bonus Balance</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme.colors.secondary }}>{currency} {bonusBalance.toFixed(2)}</div>
            </div>

            <div style={{ marginTop: 'auto' }}>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        marginBottom: '10px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.2)',
                        color: '#fff',
                        boxSizing: 'border-box'
                    }}
                />
                <button
                    onClick={handleDeposit}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: theme.colors.secondary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? 'Processing...' : 'Quick Deposit'}
                </button>
            </div>
        </div>
    );
};
