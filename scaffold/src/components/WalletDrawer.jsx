import React, { useState } from 'react';
import { useBalance, usePayments, useSession } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import theme from '../../theme.config';

export const WalletDrawer = ({ isOpen, onClose, player }) => {
    const { balance, bonusBalance, currency, refresh } = useBalance(player?.user_id);
    const { deposit, loading, error } = usePayments(player?.user_id);
    const [step, setStep] = useState('MAIN'); // MAIN, DEPOSIT, SUCCESS
    const [amount, setAmount] = useState('50');

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
        <div style={{
            position: 'fixed', top: 0, right: 0, width: '340px', height: '100%',
            background: '#0a0a0f', color: '#fff', zIndex: 1001,
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                padding: '24px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '0.5px' }}>MY WALLET</h2>
                <button onClick={() => { setStep('MAIN'); onClose(); }} style={{
                    background: 'none', border: 'none', color: '#666',
                    fontSize: '24px', cursor: 'pointer'
                }}>×</button>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                {step === 'MAIN' && (
                    <>
                        {/* Balance Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1e1e2d 0%, #161625 100%)',
                            padding: '20px', borderRadius: '16px', marginBottom: '24px',
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

                        {/* Quick Deposit Actions */}
                        <h3 style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>DEPOSIT FUNDS</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                            {['10', '50', '100'].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setAmount(amt)}
                                    style={{
                                        padding: '12px 0', borderRadius: '8px',
                                        background: amount === amt ? `${theme.colors.primary}22` : 'rgba(255,255,255,0.03)',
                                        color: amount === amt ? theme.colors.primary : '#fff',
                                        border: `1px solid ${amount === amt ? theme.colors.primary : 'rgba(255,255,255,0.05)'}`,
                                        cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    {currency} {amt}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Custom amount..."
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: '#0a0a0f', border: '1px solid #333',
                                color: '#fff', boxSizing: 'border-box', marginBottom: '20px'
                            }}
                        />
                        <button
                            onClick={() => handleQuickDeposit(amount)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px',
                                background: theme.colors.primary, color: '#fff',
                                border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '15px'
                            }}
                        >
                            Deposit Now
                        </button>

                        {/* Simulation Tools */}
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginBottom: '4px' }}>DEBUG & SIMULATION</div>
                            <button
                                onClick={async () => {
                                    logSDKEvent('WALLET', `Simulating Demo Deposit: ${amount}`);
                                    setStep('PROCESSING');

                                    try {
                                        const apiUrl = import.meta.env.VITE_NEOSTRIKE_API_URL || '';
                                        logSDKEvent('DEBUG', `Fetch: ${apiUrl}/api/v1/demo/deposit`);

                                        const res = await fetch(`${apiUrl}/api/v1/demo/deposit`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                user_id: player?.user_id || 'test01',
                                                amount: parseFloat(amount)
                                            })
                                        });

                                        if (!res.ok) {
                                            const errorData = await res.json().catch(() => ({}));
                                            throw new Error(errorData.error || `Server responded with ${res.status}`);
                                        }

                                        setTimeout(() => {
                                            logSDKEvent('SDK', 'Simulated Payment SUCCESS (DB Updated)');
                                            setStep('SUCCESS');
                                            refresh();
                                        }, 1500);
                                    } catch (err) {
                                        console.error('[Demo Deposit Error]', err);
                                        logSDKEvent('ERROR', `Demo deposit failed: ${err.message}`);
                                        setStep('MAIN');
                                    }
                                }}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    background: 'transparent', color: '#00ff88',
                                    border: '1px dashed #00ff88', fontWeight: 'bold', cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                ⚡ SIMULATE DEMO DEPOSIT
                            </button>
                            <button
                                onClick={() => {
                                    logSDKEvent('SDK', 'Resetting Balance (Simulation)');
                                    refresh();
                                }}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    background: 'transparent', color: '#666',
                                    border: '1px dashed #333', fontWeight: 'bold', cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                🔄 REFRESH BALANCE (SDK)
                            </button>
                        </div>

                        <div style={{ marginTop: '30px', fontSize: '12px', color: '#555', textAlign: 'center' }}>
                            Powered by NeoStrike SDK Payment Engine
                        </div>
                    </>
                )}

                {step === 'PROCESSING' && (
                    <div style={{ textAlign: 'center', marginTop: '100px' }}>
                        <div className="spinner" style={{ fontSize: '40px', marginBottom: '20px' }}>⌛</div>
                        <h3>Processing Payment...</h3>
                        <p style={{ color: '#888', fontSize: '13px' }}>Talking to NeoStrike Gateways</p>
                    </div>
                )}

                {step === 'SUCCESS' && (
                    <div style={{ textAlign: 'center', marginTop: '60px' }}>
                        <div style={{
                            fontSize: '60px', color: '#00ff88', marginBottom: '20px',
                            background: '#00ff8822', width: '100px', height: '100px',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 20px'
                        }}>✓</div>
                        <h3 style={{ color: '#00ff88' }}>Deposit Successful!</h3>
                        <p style={{ color: '#888', fontSize: '14px', marginBottom: '30px' }}>
                            Your funds are now available in your balance.
                        </p>
                        <button
                            onClick={() => setStep('MAIN')}
                            style={{
                                padding: '12px 30px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.05)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                            }}
                        >
                            Return to Wallet
                        </button>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '16px', background: '#ff444422', borderTop: '1px solid #ff4444',
                    color: '#ff4444', fontSize: '13px'
                }}>
                    <strong>SDK Error:</strong> {JSON.stringify(error)}
                </div>
            )}
        </div>
    );
};

