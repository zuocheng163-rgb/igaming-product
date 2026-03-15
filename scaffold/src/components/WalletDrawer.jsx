import React, { useState } from 'react';
import { useBalance, useSession, CashierModal, AccountDashboard } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import theme from '../../theme.config';

export const WalletDrawer = ({ isOpen, onClose, player }) => {
    const { getToken } = useSession();
    const sessionToken = getToken();
    const { balance, bonusBalance, currency, refresh } = useBalance(player?.user_id, { token: sessionToken });
    const [isCashierOpen, setCashierOpen] = useState(false);
    const [isAccountOpen, setAccountOpen] = useState(false);

    if (!isOpen) return null;

    const handleQuickDeposit = async (amt) => {
        setStep('PROCESSING');
        try {
            logSDKEvent('UI', `Confirming deposit of ${amt} ${currency}`);
            await deposit(parseFloat(amt));
            refresh();
            setStep('SUCCESS');
        } catch (err) {
            setStep('MAIN');
            logSDKEvent('ERROR', 'Deposit process aborted');
        }
    };

    const StatusBadge = ({ type, text }) => (
        <span style={{
            fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
            background: type === 'success' ? '#00ff8822' : '#ff444422',
            color: type === 'success' ? '#00ff88' : '#ff4444',
            border: `1px solid ${type === 'success' ? '#00ff88' : '#ff4444'}`,
            marginLeft: '8px', textTransform: 'uppercase'
        }}>
            {text}
        </span>
    );

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, right: 0, width: '340px', height: '100%',
                background: '#0a0a0f', color: '#fff', zIndex: 1001,
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: 'column',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s ease'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '0.5px' }}>MY WALLET</h2>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#666',
                        fontSize: '24px', cursor: 'pointer'
                    }}>×</button>
                </div>

                <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                    {/* Balance Card */}
                    <div style={{
                        background: 'linear-gradient(135deg, #1e1e2d 0%, #161625 100%)',
                        padding: '20px', borderRadius: '16px', marginBottom: '32px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Total Balance</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: theme.colors.primary }}>
                            {currency} {(balance + bonusBalance).toFixed(2)}
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#aaa' }}>Real Cash:</span>
                            <span style={{ fontWeight: 'bold' }}>{currency} {balance.toFixed(2)}</span>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#aaa' }}>Bonus:</span>
                            <span style={{ fontWeight: 'bold', color: theme.colors.secondary }}>{currency} {bonusBalance.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <button
                            onClick={() => setCashierOpen(true)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px',
                                background: theme.colors.primary, color: '#fff',
                                border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '15px'
                            }}
                        >
                            Open Cashier
                        </button>
                        
                        <button
                            onClick={() => setAccountOpen(true)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '15px'
                            }}
                        >
                            Account Dashboard
                        </button>
                    </div>

                    <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', marginBottom: '10px' }}>Recent Activity</div>
                        <div style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                            View full history in Account Dashboard
                        </div>
                    </div>
                </div>

                <div style={{ padding: '20px', fontSize: '12px', color: '#444', textAlign: 'center' }}>
                    NeoStrike SDK v1.0.0
                </div>
            </div>

            {/* SDK Modals */}
            <CashierModal 
                isOpen={isCashierOpen} 
                onClose={() => setCashierOpen(false)} 
                onTransactionSuccess={() => {
                    refresh();
                    logSDKEvent('UI', 'Transaction successful, refreshing balance');
                }}
            />
            
            <AccountDashboard 
                isOpen={isAccountOpen} 
                onClose={() => setAccountOpen(false)} 
                user={player}
            />

            {/* Backdrop for Drawer */}
            {isOpen && (
                <div 
                    onClick={onClose}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}
                />
            )}
        </>
    );
};

