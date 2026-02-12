import React, { useState, useEffect } from 'react';
import DataTable from './DataTable';
import { Save, RefreshCw, Shield, Bell, Lock } from 'lucide-react';

export const Players = ({ token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = () => {
        setLoading(true);
        fetch('/api/operator/search?q=', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(res => {
                const players = res.players || [];
                const enriched = players.map(p => ({
                    ...p,
                    balance: p.balance || 0,
                    status: 'Active',
                    last_login: new Date().toISOString()
                }));
                setData(enriched);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchData();
        setTimeout(() => setRefreshing(false), 500);
    };

    const columns = [
        { header: 'User ID', accessor: 'user_id' },
        { header: 'Username', accessor: 'username' },
        { header: 'Email', accessor: 'email' },
        { header: 'Balance', accessor: 'balance', render: row => `€${(row.balance || 0).toFixed(2)}` },
        {
            header: 'Status', accessor: 'status', render: row => (
                <span style={{
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                    background: row.status === 'Active' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 0, 0.1)',
                    color: row.status === 'Active' ? '#00ff88' : '#ffd700'
                }}>
                    {row.status}
                </span>
            )
        },
        { header: 'Last Login', accessor: 'last_login', render: row => new Date(row.last_login).toLocaleString() }
    ];

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Player Management</h2>
                <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagination={{ page: 1, totalPages: 1 }}
                searchPlaceholder="Search players..."
            />
        </div>
    );
};

export const Wallet = ({ token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = () => {
        setLoading(true);
        fetch('/api/operator/search?q=', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(res => {
                const txs = res.transactions || [];
                setData(txs.map(tx => ({
                    ...tx,
                    user: tx.user_id,
                    type: tx.action?.split(':')[1]?.toUpperCase() || 'TRANSACTION',
                    amount: tx.metadata?.request?.amount || tx.amount || 0,
                    status: tx.status || 'Success',
                    date: tx.timestamp || tx.created_at || new Date().toISOString()
                })));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchData();
        setTimeout(() => setRefreshing(false), 500);
    };

    const columns = [
        { header: 'Transaction ID', accessor: 'transaction_id' },
        { header: 'User', accessor: 'user' },
        { header: 'Type', accessor: 'type' },
        {
            header: 'Amount', accessor: 'amount', render: row => (
                <span style={{ color: row.amount > 0 ? '#00ff88' : '#ff4d4d' }}>
                    {row.amount > 0 ? '+' : ''}€{row.amount}
                </span>
            )
        },
        { header: 'Status', accessor: 'status' },
        { header: 'Date', accessor: 'date', render: row => new Date(row.date).toLocaleString() }
    ];

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Wallet Transactions</h2>
                <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagination={{ page: 1, totalPages: 1 }}
                searchPlaceholder="Search transactions..."
            />
        </div>
    );
};

export const Games = () => {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Game Catalog</h2>
                <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {['Starburst', 'Book of Dead', 'Gonzo\'s Quest', 'Aviator', 'Sweet Bonanza'].map(game => (
                    <div key={game} className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                        <div style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '12px' }}></div>
                        <h4>{game}</h4>
                        <button className="btn-primary" style={{ marginTop: '12px', width: '100%' }}>Configure</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Compliance = () => {
    const [data] = useState([
        { id: 'AL-502', user: 'player_one', trigger: 'Velocity Limit', risk: 'Medium', status: 'Under Review', date: '2026-02-12T11:00:00Z' },
        { id: 'AL-501', user: 'unknown', trigger: 'IP Mismatch', risk: 'High', status: 'Open', date: '2026-02-11T08:30:00Z' },
    ]);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const columns = [
        { header: 'Alert ID', accessor: 'id' },
        { header: 'User', accessor: 'user' },
        { header: 'Trigger', accessor: 'trigger' },
        {
            header: 'Risk Level', accessor: 'risk', render: row => (
                <span style={{
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                    background: row.risk === 'High' ? 'rgba(255, 77, 77, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                    color: row.risk === 'High' ? '#ff4d4d' : '#ffd700'
                }}>
                    {row.risk}
                </span>
            )
        },
        { header: 'Status', accessor: 'status' },
        { header: 'Date', accessor: 'date', render: row => new Date(row.date).toLocaleString() }
    ];

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Compliance & Risk</h2>
                <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <DataTable
                columns={columns}
                data={data}
                pagination={{ page: 1, totalPages: 1 }}
                searchPlaceholder="Search alerts..."
            />
        </div>
    );
};

export const Settings = () => {
    return (
        <div className="page-container" style={{ padding: '24px', maxWidth: '800px' }}>
            <h2 className="page-title" style={{ marginBottom: '24px' }}>Platform Settings</h2>

            <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#00ccff' }}>
                    <Lock size={20} />
                    <h3>Security Policy</h3>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Session Timeout (minutes)</label>
                    <input type="number" defaultValue={30} className="input-field" style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="checkbox" defaultChecked id="mfa" style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="mfa" style={{ color: 'var(--text-primary)' }}>Enforce MFA for Admin Access</label>
                </div>
            </section>

            <section className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#ffd700' }}>
                    <Bell size={20} />
                    <h3>Notification Preferences</h3>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <input type="checkbox" defaultChecked id="email_notif" style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="email_notif" style={{ color: 'var(--text-primary)' }}>Email Alerts for Critical Events</label>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="checkbox" id="slack_notif" style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="slack_notif" style={{ color: 'var(--text-primary)' }}>Slack Integration</label>
                </div>
            </section>

            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                <Save size={18} />
                Save Changes
            </button>
        </div>
    );
};
