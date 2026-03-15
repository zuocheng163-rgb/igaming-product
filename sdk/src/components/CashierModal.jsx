import React, { useState, useEffect } from 'react';
import { usePayments } from '../hooks';

const CashierModal = ({ isOpen, onClose, onTransactionSuccess }) => {
    const [activeTab, setActiveTab] = useState('deposit');
    const [methods, setMethods] = useState([]);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [amount, setAmount] = useState('100');
    const { loading, error, getMethods, submitPayment } = usePayments();
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadMethods();
            setStatus(null);
            setSelectedMethod(null);
        }
    }, [isOpen, activeTab]);

    const loadMethods = async () => {
        const data = await getMethods(activeTab);
        setMethods(data);
    };

    const handleProcess = async () => {
        if (!selectedMethod || !amount) return;
        
        setStatus({ type: 'info', message: 'Processing transaction...' });
        const result = await submitPayment({
            type: activeTab,
            method_id: selectedMethod.id,
            amount: parseFloat(amount),
            currency: 'EUR'
        });

        if (result.success) {
            setStatus({ type: 'success', message: `Successfully ${activeTab === 'deposit' ? 'deposited' : 'withdrawn'} ${amount} EUR` });
            if (onTransactionSuccess) onTransactionSuccess(result);
            setTimeout(onClose, 2000);
        } else {
            setStatus({ type: 'error', message: result.error || 'Transaction failed' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="sdk-modal-overlay" style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <div className="sdk-modal-content glass-panel" style={{
                width: '100%', maxWidth: '500px',
                background: 'linear-gradient(180deg, rgba(30,30,50,0.95) 0%, rgba(15,15,25,0.98) 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                animation: 'modalSlideIn 0.3s ease'
            }}>
                {/* Header */}
                <div style={{ padding: '24px', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '1px' }}>CASHIER</h2>
                    <button onClick={onClose} style={{
                        position: 'absolute', right: '20px', top: '24px',
                        background: 'transparent', border: 'none', color: 'white',
                        fontSize: '1.5rem', cursor: 'pointer', opacity: 0.6
                    }}>×</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)' }}>
                    {['deposit', 'withdrawal'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '16px', border: 'none',
                                background: activeTab === tab ? 'transparent' : 'rgba(255,255,255,0.02)',
                                color: activeTab === tab ? 'var(--primary, #00ccff)' : 'rgba(255,255,255,0.4)',
                                fontWeight: 700, cursor: 'pointer',
                                borderBottom: activeTab === tab ? '3px solid var(--primary, #00ccff)' : '3px solid transparent',
                                textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div style={{ padding: '24px' }}>
                    {status && (
                        <div style={{
                            padding: '12px', borderRadius: '8px', marginBottom: '20px',
                            background: status.type === 'error' ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,0,0.1)',
                            color: status.type === 'error' ? '#ff4444' : '#00ff88',
                            fontSize: '0.9rem', textAlign: 'center', border: `1px solid ${status.type === 'error' ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,0,0.2)'}`
                        }}>
                            {status.message}
                        </div>
                    )}

                    {/* Amount Input */}
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase' }}>Amount (EUR)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            style={{
                                width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                                color: 'white', fontSize: '1.2rem', fontWeight: 700, outline: 'none'
                            }}
                        />
                    </div>

                    {/* Method Selection */}
                    <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase' }}>Select Payment Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '32px' }}>
                        {loading && methods.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', opacity: 0.5 }}>Loading methods...</div>
                        ) : methods.map(m => (
                            <div
                                key={m.id}
                                onClick={() => setSelectedMethod(m)}
                                style={{
                                    padding: '16px', borderRadius: '16px', textAlign: 'center',
                                    background: selectedMethod?.id === m.id ? 'rgba(0,204,255,0.1)' : 'rgba(255,255,255,0.03)',
                                    border: `2px solid ${selectedMethod?.id === m.id ? 'var(--primary, #00ccff)' : 'transparent'}`,
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{m.icon || '💳'}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{m.name}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleProcess}
                        disabled={loading || !selectedMethod || !amount}
                        style={{
                            width: '100%', padding: '18px', borderRadius: '16px',
                            background: 'var(--primary, #00ccff)', color: '#000',
                            border: 'none', fontWeight: 800, fontSize: '1rem',
                            cursor: 'pointer', opacity: (loading || !selectedMethod || !amount) ? 0.5 : 1,
                            transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '1px'
                        }}
                    >
                        {loading ? 'PROCESSING...' : `CONFIRM ${activeTab}`}
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}} />
        </div>
    );
};

export default CashierModal;
