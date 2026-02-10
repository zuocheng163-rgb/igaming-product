import React from 'react';
import useSWR from 'swr';
import OperatorLayout from './OperatorLayout';
import GGRTrendChart from './GGRTrendChart';
import { Users, TrendingUp, CheckCircle, ShieldAlert } from 'lucide-react';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const PortalDashboard = ({ token, onLogout }) => {
    const { data: stats } = useSWR(
        token ? ['/api/operator/stats', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 60000 }
    );

    const kpiData = [
        { label: 'Active Players', value: stats?.active_players || 0, icon: Users, color: '#00ccff' },
        { label: 'Total GGR', value: `€${stats?.ggr?.toLocaleString() || 0}`, icon: TrendingUp, color: '#ffd700' },
        { label: 'Approval Rate', value: `${stats?.approval_rate || 0}%`, icon: CheckCircle, color: '#00ff88' },
        { label: 'Compliance Alerts', value: stats?.compliance_alerts || 0, icon: ShieldAlert, color: '#ff4d4d' },
    ];

    return (
        <OperatorLayout token={token} onLogout={onLogout}>
            <div className="dashboard-content">
                <div className="kpi-strip">
                    {kpiData.map((kpi, i) => (
                        <div key={i} className="kpi-card glass-panel floating" style={{ '--delay': `${i * 0.1}s` }}>
                            <div className="kpi-icon" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                            <div className="kpi-info">
                                <label>{kpi.label}</label>
                                <div className="value">{kpi.value}</div>
                                <div className="small-trend up">+12% vs last period</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="charts-grid">
                    <GGRTrendChart data={stats?.ggr_history || []} />

                    <div className="side-panels">
                        <section className="glass-panel recent-activity">
                            <h3>Live Operational Stream</h3>
                            <div className="activity-list">
                                {stats?.recent_events?.length > 0 ? stats.recent_events.map((ev, i) => (
                                    <div key={i} className="activity-item">
                                        <div className="dot"></div>
                                        <div className="info">
                                            <p>{ev.message}</p>
                                            <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                )) : <p className="empty">No recent activity</p>}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

        </OperatorLayout>
    );
};

export default PortalDashboard;
