import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import OperatorLayout from './OperatorLayout';
import GGRTrendChart from './GGRTrendChart';
import KPICard from './KPICard';
import { Users, TrendingUp, CheckCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import { Players, Wallet, Games, Compliance, Settings } from './Pages';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const PortalDashboard = ({ token, onLogout }) => {
    const { data: stats, mutate } = useSWR(
        token ? ['/api/operator/stats', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 60000 }
    );

    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await mutate();
        setTimeout(() => setRefreshing(false), 500);
    };

    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    useEffect(() => {
        const handleLocationChange = () => {
            setCurrentPath(window.location.pathname);
        };

        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const m = stats?.metrics;

    const kpiConfig = [
        { label: 'Active Players', metric: m?.active_players, icon: Users, color: '#00ccff' },
        { label: 'Total GGR', metric: m?.ggr, icon: TrendingUp, color: '#ffd700', prefix: '€' },
        { label: 'Approval Rate', metric: m?.approval_rate, icon: CheckCircle, color: '#00ff88', suffix: '%' },
        { label: 'Compliance Alerts', metric: m?.compliance_alerts, icon: ShieldAlert, color: '#ff4d4d' },
    ];

    const renderContent = () => {
        if (currentPath.includes('/portal/players')) return <Players token={token} />;
        if (currentPath.includes('/portal/wallet')) return <Wallet token={token} />;
        if (currentPath.includes('/portal/games')) return <Games token={token} />;
        if (currentPath.includes('/portal/compliance')) return <Compliance token={token} />;
        if (currentPath.includes('/portal/settings')) return <Settings token={token} />;

        return (
            <div className="dashboard-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Dashboard Overview</h2>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
                    >
                        <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="kpi-strip">
                    {kpiConfig.map((kpi, i) => (
                        <KPICard
                            key={i}
                            label={kpi.label}
                            value={`${kpi.prefix || ''}${kpi.metric?.value?.toLocaleString() || 0}${kpi.suffix || ''}`}
                            trend={kpi.metric?.trend || 0}
                            sparkline={kpi.metric?.sparkline || []}
                            icon={kpi.icon}
                            color={kpi.color}
                            delay={`${i * 0.1}s`}
                        />
                    ))}
                </div>

                <div className="charts-grid">
                    <GGRTrendChart data={stats?.ggr_history || []} />

                    <div className="side-panels">
                        <section className="glass-panel recent-activity">
                            <div className="section-header">
                                <h3>Live Operational Stream</h3>
                            </div>
                            <div className="activity-list">
                                {stats?.recent_events?.length > 0 ? stats.recent_events.map((ev, i) => (
                                    <div key={i} className="activity-item">
                                        <div className={`dot ${ev.type === 'inbound' ? 'inbound-dot' : 'outbound-dot'}`}></div>
                                        <div className="info" style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: ev.type === 'inbound' ? 'rgba(0, 255, 163, 0.1)' : 'rgba(121, 40, 202, 0.1)',
                                                    color: ev.type === 'inbound' ? 'var(--success)' : 'var(--secondary)',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {ev.method} {ev.endpoint}
                                                </span>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    {new Date(ev.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p style={{ color: '#e0e0e0', fontWeight: 500 }}>{ev.message || (ev.type === 'inbound' ? 'Inbound Request Received' : 'Outbound Event Pushed')}</p>
                                        </div>
                                    </div>
                                )) : <p className="empty">No recent activity</p>}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <OperatorLayout token={token} onLogout={onLogout} user={stats?.user}>
            {renderContent()}
        </OperatorLayout>
    );
};

export default PortalDashboard;
