import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import OperatorLayout from './OperatorLayout';
import GGRTrendChart from './GGRTrendChart';
import KPICard from './KPICard';
import { Users, TrendingUp, CheckCircle, ShieldAlert } from 'lucide-react';
import { Players, Wallet, Games, Compliance, Settings } from './Pages';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const PortalDashboard = ({ token, onLogout }) => {
    const { data: stats } = useSWR(
        token ? ['/api/operator/stats', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 60000 }
    );

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
                                        <div className="dot"></div>
                                        <div className="info">
                                            <p>{ev.message}</p>
                                            <div className="meta">
                                                <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                                <span className="dot-sep">•</span>
                                                <span>{ev.type || 'System'}</span>
                                            </div>
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
