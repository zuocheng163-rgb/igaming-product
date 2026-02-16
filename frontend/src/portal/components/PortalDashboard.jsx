import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import OperatorLayout from './OperatorLayout';
import GGRTrendChart from './GGRTrendChart';
import KPICard from './KPICard';
import { Users, TrendingUp, CheckCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import { Players, Wallet, Games, Compliance, Settings } from './Pages';
import OperationalStream from './OperationalStream';
import FastTrackStatusWidget from './FastTrackStatusWidget';
import ActiveProvidersWidget from './ActiveProvidersWidget';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const PortalDashboard = ({ user, token, onLogout }) => {
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

    const handleNavigate = (path, filterFn) => {
        // Simple client-side navigation since Pages.jsx handles routing via currentPath state
        window.history.pushState({}, '', path);

        // Trigger generic popstate event to notify components
        const navEvent = new PopStateEvent('popstate');
        window.dispatchEvent(navEvent);

        // Persist filter if provided
        if (filterFn) filterFn();
    };

    const renderContent = () => {
        if (currentPath.includes('/portal/players')) return <Players user={user} token={token} />;
        if (currentPath.includes('/portal/wallet')) return <Wallet user={user} token={token} />;
        if (currentPath.includes('/portal/games')) return <Games user={user} token={token} />;
        if (currentPath.includes('/portal/compliance')) return <Compliance user={user} token={token} />;
        if (currentPath.includes('/portal/settings')) return <Settings user={user} token={token} />;
        if (currentPath.includes('/portal/operational-stream')) return <OperationalStream user={user} token={token} />;

        return (
            <div className="dashboard-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Dashboard Overview <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>v1.1.2</span></h2>
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
                            onClick={() => {
                                if (kpi.label === 'Active Players') {
                                    handleNavigate('/portal/players', () => {
                                        const now = new Date();
                                        now.setDate(now.getDate() - 1);
                                        const day = String(now.getDate()).padStart(2, '0');
                                        const month = String(now.getMonth() + 1).padStart(2, '0');
                                        const year = now.getFullYear();
                                        const yesterdayFormatted = `${day}/${month}/${year}`;
                                        sessionStorage.setItem('playerFilters', JSON.stringify({
                                            last_login: `>= ${yesterdayFormatted}`
                                        }));
                                    });
                                } else if (kpi.label === 'Total GGR') {
                                    handleNavigate('/portal/wallet', () => {
                                        sessionStorage.setItem('transactionFilters', JSON.stringify({
                                            type: 'DEBIT', // Closest to GGR
                                            status: 'success'
                                        }));
                                    });
                                } else if (kpi.label === 'Approval Rate') {
                                    handleNavigate('/portal/wallet', () => {
                                        sessionStorage.setItem('transactionFilters', JSON.stringify({
                                            status: 'failed'
                                        }));
                                    });
                                } else if (kpi.label === 'Compliance Alerts') {
                                    handleNavigate('/portal/compliance');
                                }
                            }}
                        />
                    ))}
                </div>

                <div className="charts-grid">
                    <GGRTrendChart data={stats?.ggr_history || []} />

                    <div className="side-panels" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <FastTrackStatusWidget
                            token={token}
                            stats={stats}
                            onClick={() => {
                                handleNavigate('/portal/operational-stream', () => {
                                    sessionStorage.setItem('operationalStreamFilters', JSON.stringify({
                                        type: 'outbound'
                                    }));
                                });
                            }}
                        />
                        <ActiveProvidersWidget />
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
