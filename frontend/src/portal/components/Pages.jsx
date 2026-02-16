import React, { useState, useEffect } from 'react';
import DataTable from './DataTable';
import { Save, RefreshCw, Shield, Bell, Lock, Gamepad2, Filter } from 'lucide-react';
import PlayerDetailsModal from './PlayerDetailsModal';

export const Players = ({ user, token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    // Filter states
    const [filters, setFilters] = useState({
        country: '',
        username: '',
        email: '',
        balance: '',
        last_login: ''
    });

    const fetchData = (page = 1, appliedFilters = {}) => {
        setLoading(true);
        fetch('/api/operator/players/filter', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'x-username': user?.username,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...appliedFilters,
                page,
                limit: 10
            })
        })
            .then(res => res.json())
            .then(result => {
                const players = result.players || [];
                const enriched = players.map(p => ({
                    ...p,
                    balance: p.balance || 0,
                    status: 'Active'
                }));
                setData(enriched);
                setPagination({
                    page: result.currentPage || 1,
                    totalPages: result.totalPages || 1,
                    total: result.total || 0
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        // Load persisted filters from sessionStorage
        const savedFilters = sessionStorage.getItem('playerFilters');
        if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            setFilters(parsed);
            fetchData(1, parsed);
        } else {
            fetchData();
        }
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchData(pagination.page, filters);
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleFilter = () => {
        // Save filters to sessionStorage
        sessionStorage.setItem('playerFilters', JSON.stringify(filters));
        fetchData(1, filters);
    };

    const handlePageChange = (newPage) => {
        fetchData(newPage, filters);
    };

    const handleRowDoubleClick = (row) => {
        if (row && row.user_id) {
            setSelectedPlayer(row.user_id);
        }
    };

    const columns = [
        { header: 'Country', accessor: 'country' },
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
        { header: 'Last Login', accessor: 'last_login', render: row => row.last_login ? new Date(row.last_login).toLocaleString() : 'Never' }
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

            {/* Filter Row */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: '12px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Country</label>
                        <input
                            type="text"
                            placeholder="e.g. MT"
                            value={filters.country}
                            onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Username</label>
                        <input
                            type="text"
                            placeholder="e.g. john"
                            value={filters.username}
                            onChange={(e) => setFilters({ ...filters, username: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</label>
                        <input
                            type="text"
                            placeholder="e.g. @gmail.com"
                            value={filters.email}
                            onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Balance</label>
                        <input
                            type="text"
                            placeholder=">= 100"
                            value={filters.balance}
                            onChange={(e) => setFilters({ ...filters, balance: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Last Login</label>
                        <input
                            type="text"
                            placeholder="> 02/15/2026"
                            value={filters.last_login}
                            onChange={(e) => setFilters({ ...filters, last_login: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleFilter}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', height: '38px' }}
                    >
                        <Filter size={16} />
                        Filter
                    </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tip: Use operators like &gt;, &gt;=, =, &lt;, &lt;= for Balance and Last Login (e.g., "&gt;= 100" or "&gt; 02/15/2026")
                </div>
            </div>

            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                searchPlaceholder="Search players..."
                onRowDoubleClick={handleRowDoubleClick}
            />
            {selectedPlayer && (
                <PlayerDetailsModal
                    userId={selectedPlayer}
                    token={token}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};

export const Wallet = ({ user, token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    // Filter states
    const [filters, setFilters] = useState({
        transaction_id: '',
        user: '',
        type: '',
        amount: '',
        date: ''
    });

    const fetchData = (page = 1, appliedFilters = {}) => {
        setLoading(true);
        fetch('/api/operator/transactions/filter', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'x-username': user?.username,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...appliedFilters,
                page,
                limit: 10
            })
        })
            .then(res => res.json())
            .then(result => {
                const txs = result.transactions || [];
                setData(txs.map(tx => ({
                    ...tx,
                    transaction_id: tx.transaction_id,
                    type: tx.type || 'TRANSACTION',
                    amount: tx.amount || 0,
                    status: tx.status || 'Success',
                    date: tx.created_at || tx.timestamp || new Date().toISOString()
                })));
                setPagination({
                    page: result.currentPage || 1,
                    totalPages: result.totalPages || 1,
                    total: result.total || 0
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        // Load persisted filters from sessionStorage
        const savedFilters = sessionStorage.getItem('transactionFilters');
        if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            setFilters(parsed);
            fetchData(1, parsed);
        } else {
            fetchData();
        }
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchData(pagination.page, filters);
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleFilter = () => {
        // Save filters to sessionStorage
        sessionStorage.setItem('transactionFilters', JSON.stringify(filters));
        fetchData(1, filters);
    };

    const handlePageChange = (newPage) => {
        fetchData(newPage, filters);
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

            {/* Filter Row */}
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '12px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Transaction ID</label>
                        <input
                            type="text"
                            placeholder="e.g. TX123"
                            value={filters.transaction_id}
                            onChange={(e) => setFilters({ ...filters, transaction_id: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>User</label>
                        <input
                            type="text"
                            placeholder="e.g. john"
                            value={filters.user}
                            onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Type</label>
                        <input
                            type="text"
                            placeholder="e.g. DEPOSIT"
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Amount</label>
                        <input
                            type="text"
                            placeholder=">= 50"
                            value={filters.amount}
                            onChange={(e) => setFilters({ ...filters, amount: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date</label>
                        <input
                            type="text"
                            placeholder="> 02/15/2026"
                            value={filters.date}
                            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</label>
                        <input
                            type="text"
                            placeholder="e.g. success"
                            value={filters.status || ''}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleFilter}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', height: '38px' }}
                    >
                        <Filter size={16} />
                        Filter
                    </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tip: Use operators like &gt;, &gt;=, =, &lt;, &lt;= for Amount and Date (e.g., "&gt;= 50" or "&gt; 02/15/2026, 10:00:00")
                </div>
            </div>

            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                searchPlaceholder="Search transactions..."
            />
        </div >
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
                        <div style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Gamepad2 size={48} style={{ color: 'var(--primary)', opacity: 0.6 }} />
                        </div>
                        <h4>{game}</h4>
                        <button className="btn-primary" style={{ marginTop: '12px', width: '100%' }}>Configure</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Compliance = ({ user, token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = () => {
        setLoading(true);
        fetch('/api/operator/compliance/alerts', {
            headers: {
                Authorization: `Bearer ${token}`,
                'x-username': user?.username
            }
        })
            .then(res => res.json())
            .then(alerts => {
                setData(alerts || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
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
                    background: row.risk === 'High' ? 'rgba(255, 77, 77, 0.2)' : row.risk === 'Medium' ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                    color: row.risk === 'High' ? '#ff4d4d' : row.risk === 'Medium' ? '#ffa500' : '#ffd700'
                }}>
                    {row.risk}
                </span>
            )
        },
        { header: 'Status', accessor: 'status' },
        { header: 'Date', accessor: 'date', render: row => new Date(row.date).toLocaleString() },
        { header: 'Message', accessor: 'message' }
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
                loading={loading}
                pagination={{ page: 1, totalPages: 1 }}
                searchPlaceholder="Search alerts..."
            />
        </div>
    );
};

export const Settings = ({ token }) => {
    const [apiKey, setApiKey] = useState('FETCHING...');
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetch('/api/operator/config', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(config => {
                if (config?.config?.operator_api_key) {
                    setApiKey(config.config.operator_api_key);
                } else {
                    setApiKey('NONE SET');
                }
            })
            .catch(err => {
                console.error('Failed to fetch config', err);
                setApiKey('ERROR LOADING');
            });
    }, [token]);

    const handleRegenerateKey = async () => {
        if (!window.confirm('Are you sure? This will invalidate the existing Operator API key immediately.')) return;

        setIsRegenerating(true);
        try {
            const newKey = `sk_op_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
            const response = await fetch('/api/operator/config/api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ api_key: newKey })
            });

            if (response.ok) {
                setApiKey(newKey);
                alert('API Key regenerated successfully. Please update your environment variables if needed.');
            } else {
                throw new Error('Failed to update API key');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsRegenerating(false);
        }
    };

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

                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Operator API Key (X-API-Key)</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            readOnly
                            value={apiKey}
                            style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#00ff88', fontFamily: 'monospace' }}
                        />
                        <button
                            onClick={handleRegenerateKey}
                            disabled={isRegenerating}
                            className="btn-primary"
                            style={{ padding: '0 15px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                            {isRegenerating ? 'REGENERATING...' : 'REGENERATE'}
                        </button>
                    </div>
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
