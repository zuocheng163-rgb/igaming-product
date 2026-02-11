import React from 'react';

export const Players = () => (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Player Management</h2>
        <p style={{ color: 'var(--text-muted)' }}>Player list and profiles will appear here.</p>
    </div>
);

export const Wallet = () => (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Wallet & Transactions</h2>
        <p style={{ color: 'var(--text-muted)' }}>Transaction history and wallet adjustments.</p>
    </div>
);

export const Games = () => (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Game Management</h2>
        <p style={{ color: 'var(--text-muted)' }}>Game catalog and configuration.</p>
    </div>
);

export const Compliance = () => (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Compliance Center</h2>
        <p style={{ color: 'var(--text-muted)' }}>KYC reqests and AML alerts.</p>
    </div>
);

export const Settings = () => (
    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Platform Settings</h2>
        <p style={{ color: 'var(--text-muted)' }}>Operator configuration and team management.</p>
    </div>
);
