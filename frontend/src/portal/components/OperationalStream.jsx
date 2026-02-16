import React, { useState, useEffect } from 'react';
import DataTable from './DataTable';
import { RefreshCw, Activity } from 'lucide-react';

const OperationalStream = ({ token }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    const [typeFilter, setTypeFilter] = useState('');

    const fetchData = (page = 1, type = typeFilter) => {
        setLoading(true);
        const query = new URLSearchParams({ page, limit: 20 });
        if (type) query.append('type', type);

        fetch(`/api/operator/operational-stream?${query.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(result => {
                setData(result.events || []);
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
        // limit fetching to only when token is available to avoid double-fetch issues
        if (!token) return;

        const savedFilter = sessionStorage.getItem('operationalStreamFilters');
        if (savedFilter) {
            const { type } = JSON.parse(savedFilter);
            if (type) {
                setTypeFilter(type);
                fetchData(1, type);
                // Clear it so it doesn't persist forever
                sessionStorage.removeItem('operationalStreamFilters');
                return;
            }
        }
        fetchData();
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        fetchData(pagination.page, typeFilter);
        setTimeout(() => setRefreshing(false), 500);
    };

    const handlePageChange = (newPage) => {
        fetchData(newPage, typeFilter);
    };

    const handleTypeFilterChange = (newType) => {
        setTypeFilter(newType);
        fetchData(1, newType);
    };

    const columns = [
        {
            header: 'Type',
            accessor: 'type',
            render: row => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    background: row.type === 'inbound' ? 'rgba(0, 255, 163, 0.1)' : 'rgba(121, 40, 202, 0.1)',
                    color: row.type === 'inbound' ? 'var(--success)' : 'var(--secondary)'
                }}>
                    {row.type}
                </span>
            )
        },
        { header: 'Method', accessor: 'method' },
        { header: 'Endpoint', accessor: 'endpoint' },
        { header: 'Message', accessor: 'message' },
        {
            header: 'Status',
            accessor: 'status',
            render: row => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    background: row.status === 200 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                    color: row.status === 200 ? '#00ff88' : '#ff4d4d'
                }}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'Timestamp',
            accessor: 'timestamp',
            render: row => new Date(row.timestamp).toLocaleString()
        }
    ];

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={24} style={{ color: 'var(--primary)' }} />
                    <h2 className="page-title" style={{ margin: 0 }}>Live Operational Stream</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="filter-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
                        {['', 'inbound', 'outbound'].map((t) => (
                            <button
                                key={t}
                                onClick={() => handleTypeFilterChange(t)}
                                style={{
                                    background: typeFilter === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: 'none',
                                    color: typeFilter === t ? 'white' : 'var(--text-muted)',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {t || 'All'}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                        <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>
            <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Showing most recent 100 events • Page {pagination.page} of {pagination.totalPages}
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                searchPlaceholder="Search events..."
            />
        </div >
    );
};

export default OperationalStream;
