import React, { useState, useEffect } from 'react';
import { useProfile, useBalance, useActivePromotions, useWebSocket } from '../hooks';

const AccountDashboard = ({ user, onClose }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const { loading, kycStatus, transactions, fetchKyc, fetchTransactions, requestErasure } = useProfile();
    const { balance, bonusBalance } = useBalance();
    const { promotions } = useActivePromotions();
    const [erasureStep, setErasureStep] = useState(0);

    const tabs = [
        { id: 'profile', label: 'Profile', icon: '👤' },
        { id: 'wallet', label: 'Wallet', icon: '💰' },
        { id: 'bonuses', label: 'Bonuses', icon: '🎁' },
        { id: 'verification', label: 'Verification', icon: '🛡️' },
        { id: 'rg', label: 'RG Controls', icon: '⚖️' },
        { id: 'preferences', label: 'Preferences', icon: '⚙️' }
    ];

    useEffect(() => {
        if (activeTab === 'verification') fetchKyc();
        if (activeTab === 'wallet') fetchTransactions();
    }, [activeTab]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="sdk-tab-pane">
                        <div style={sectionStyle}>
                            <h4 style={sectionTitleStyle}>General Information</h4>
                            <div style={infoGridStyle}>
                                <div style={infoItemStyle}><label>Username</label><span>{user.username}</span></div>
                                <div style={infoItemStyle}><label>Email</label><span>{user.email || 'N/A'}</span></div>
                                <div style={infoItemStyle}><label>Account ID</label><span>{user.user_id}</span></div>
                                <div style={infoItemStyle}><label>Member Since</label><span>{new Date(user.created_at).toLocaleDateString()}</span></div>
                            </div>
                        </div>
                    </div>
                );
            case 'wallet':
                return (
                    <div className="sdk-tab-pane">
                        <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="glass-panel" style={balanceCardStyle}>
                                <label>REAL BALANCE</label>
                                <h3>{balance.toFixed(2)} EUR</h3>
                            </div>
                            <div className="glass-panel" style={{ ...balanceCardStyle, borderColor: 'rgba(255,215,0,0.3)' }}>
                                <label>BONUS BALANCE</label>
                                <h3 style={{ color: '#ffd700' }}>{bonusBalance.toFixed(2)} EUR</h3>
                            </div>
                        </div>
                        <h4 style={sectionTitleStyle}>Recent Transactions</h4>
                        <div style={transactionListStyle}>
                            {transactions.length > 0 ? transactions.map(tx => (
                                <div key={tx.id} style={transactionItemStyle}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{tx.type}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(tx.created_at).toLocaleString()}</div>
                                    </div>
                                    <div style={{ fontWeight: 800, color: tx.amount < 0 ? '#ff4444' : '#00ff88' }}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount} EUR
                                    </div>
                                </div>
                            )) : <div style={emptyStateStyle}>No recent transactions found.</div>}
                        </div>
                    </div>
                );
            case 'bonuses':
                return (
                    <div className="sdk-tab-pane">
                        <h4 style={sectionTitleStyle}>Available Offers</h4>
                        <div style={promoListStyle}>
                            {promotions.length > 0 ? promotions.map(p => (
                                <div key={p.id} className="glass-panel" style={promoCardStyle}>
                                    <div style={{ fontSize: '1.5rem' }}>🎁</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{p.description}</div>
                                    </div>
                                    <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Claim</button>
                                </div>
                            )) : <div style={emptyStateStyle}>No active promotions for your account.</div>}
                        </div>
                    </div>
                );
            case 'verification':
                return (
                    <div className="sdk-tab-pane">
                        <div style={sectionStyle}>
                            <h4 style={sectionTitleStyle}>Identity Verification (KYC)</h4>
                            <div style={kycBadgeStyle(kycStatus?.status)}>
                                {kycStatus?.status?.toUpperCase() || 'NOT STARTED'}
                            </div>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '16px' }}>
                                To comply with international anti-money laundering regulations, we require identity verification for all accounts.
                            </p>
                            <button className="btn-outline" style={{ width: '100%', marginTop: '12px' }}>Upload Documents</button>
                        </div>
                        <div style={{ ...sectionStyle, marginTop: '24px', border: '1px solid rgba(255,0,0,0.1)', background: 'rgba(255,0,0,0.02)' }}>
                            <h4 style={{ ...sectionTitleStyle, color: '#ff4444' }}>Account Erasure (GDPR)</h4>
                            {erasureStep === 0 ? (
                                <button onClick={() => setErasureStep(1)} className="btn-outline" style={{ color: '#ff4444', borderColor: 'rgba(255,0,0,0.3)' }}>Request Data Deletion</button>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#ff4444' }}>This action is irreversible. Are you sure?</p>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                        <button onClick={() => setErasureStep(0)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                                        <button onClick={requestErasure} className="btn-primary" style={{ flex: 1, background: '#ff4444' }}>Confirm</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'rg':
                return (
                    <div className="sdk-tab-pane">
                        <h4 style={sectionTitleStyle}>Responsible Gaming Controls</h4>
                        <div style={rgGridStyle}>
                            <div style={rgCardStyle}>
                                <label>Daily Deposit Limit</label>
                                <input type="number" defaultValue="500" style={rgInputStyle} />
                            </div>
                            <div style={rgCardStyle}>
                                <label>Session Time Limit</label>
                                <input type="number" defaultValue="60" style={rgInputStyle} />
                            </div>
                        </div>
                        <button className="btn-primary" style={{ width: '100%', background: '#ff4444', marginTop: '24px' }}>Self Exclusion</button>
                    </div>
                );
            default:
                return <div style={emptyStateStyle}>Preferences module coming soon.</div>;
        }
    };

    return (
        <div className="sdk-modal-overlay" style={overlayStyle}>
            <div className="sdk-dashboard glass-panel" style={containerStyle}>
                <div style={sidebarStyle} className="sdk-dashboard-sidebar">
                    <div style={sidebarHeaderStyle}>
                        <div style={avatarStyle}>NS</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user.username}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>VERIFIED PLAYER</div>
                        </div>
                    </div>
                    <nav style={navStyle}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={navLinkStyle(activeTab === tab.id)}
                            >
                                <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    <button onClick={onClose} style={logoutButtonStyle}>CLOSE DASHBOARD</button>
                </div>
                <main style={mainContentStyle}>
                    <header style={headerStyle}>
                        <h2 style={{ margin: 0, textTransform: 'uppercase' }}>{activeTab}</h2>
                    </header>
                    <div style={scrollContentStyle}>
                        {renderTabContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

// Styles
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const containerStyle = { display: 'flex', width: '100%', maxWidth: '1000px', height: '100%', maxHeight: '700px', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' };
const sidebarStyle = { width: '260px', background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '32px 0' };
const sidebarHeaderStyle = { padding: '0 32px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' };
const avatarStyle = { width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary, #00ccff)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem' };
const navStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' };
const navLinkStyle = (active) => ({ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 32px', border: 'none', background: active ? 'rgba(0,204,255,0.1)' : 'transparent', color: active ? 'var(--primary, #00ccff)' : 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer', textAlign: 'left', borderLeft: `4px solid ${active ? 'var(--primary, #00ccff)' : 'transparent'}`, transition: 'all 0.2s ease' });
const logoutButtonStyle = { margin: '0 32px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' };
const mainContentStyle = { flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' };
const headerStyle = { padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const scrollContentStyle = { flex: 1, overflowY: 'auto', padding: '40px' };
const sectionStyle = { padding: '24px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)' };
const sectionTitleStyle = { margin: '0 0 20px 0', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--primary, #00ccff)', letterSpacing: '1px' };
const infoGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' };
const infoItemStyle = { display: 'flex', flexDirection: 'column', gap: '4px' };
const balanceCardStyle = { padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' };
const transactionListStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const transactionItemStyle = { padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const emptyStateStyle = { textAlign: 'center', padding: '40px', opacity: 0.5, fontStyle: 'italic' };
const kycBadgeStyle = (status) => ({ display: 'inline-block', padding: '8px 16px', borderRadius: '8px', background: status === 'verified' ? '#00ff8844' : 'rgba(255,255,255,0.1)', color: status === 'verified' ? '#00ff88' : 'white', fontWeight: 800, fontSize: '0.8rem', border: `1px solid ${status === 'verified' ? '#00ff8866' : 'rgba(255,255,255,0.2)'}` });
const promoListStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const promoCardStyle = { display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' };
const rgGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const rgCardStyle = { padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' };
const rgInputStyle = { width: '100%', marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' };

export default AccountDashboard;
