import React, { useState, useEffect } from 'react';
import axios from 'axios';

function TenantPortal({ token, onLogout }) {
    const [summary, setSummary] = useState(null);
    const [liveMetrics, setLiveMetrics] = useState(null);
    const [churnRisks, setChurnRisks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [summaryRes, liveRes, churnRes] = await Promise.all([
                    axios.get('/api/stats/summary', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/stats/live', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/stats/churn', { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setSummary(summaryRes.data);
                setLiveMetrics(liveRes.data);
                setChurnRisks(churnRes.data);
            } catch (error) {
                console.error('Failed to fetch portal data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [token]);

    if (loading) return <div className="loading">Initializing Tenant Portal...</div>;

    return (
        <div className="tenant-portal dashboard">
            <header>
                <div>
                    <h1 className="logo-text">NeoStrike <span style={{ color: 'var(--accent-gold)' }}>Portal</span></h1>
                    <p style={{ color: 'var(--text-muted)' }}>Enterprise Operator Console</p>
                </div>
                <button className="btn-outline" onClick={onLogout}>Logout</button>
            </header>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <div className="hero-balance glass-panel">
                    <label>Total GGR</label>
                    <h2 style={{ color: 'var(--primary)' }}>{summary?.ggr.toFixed(2)} <small>EUR</small></h2>
                </div>
                <div className="hero-balance glass-panel">
                    <label>Total NGR</label>
                    <h2 style={{ color: 'var(--accent-blue)' }}>{summary?.ngr.toFixed(2)} <small>EUR</small></h2>
                </div>
                <div className="hero-balance glass-panel">
                    <label>Live Volume (1h)</label>
                    <h2>{liveMetrics?.recent_transaction_volume} <small>TXs</small></h2>
                </div>
                <div className="hero-balance glass-panel">
                    <label>Active Players</label>
                    <h2>{summary?.active_users}</h2>
                </div>
            </div>

            <div className="grid-layout">
                <div className="main-column">
                    <section className="glass-panel">
                        <div className="section-header">
                            <h3>⚠️ Anomaly Detection & Live Risk</h3>
                        </div>
                        <div className="anomaly-list">
                            {liveMetrics?.anomalies.length > 0 ? liveMetrics.anomalies.map((a, i) => (
                                <div key={i} className={`anomaly-card ${a.severity.toLowerCase()}`}>
                                    <span>{a.type}</span>
                                    <strong>{a.severity}</strong>
                                </div>
                            )) : <p className="text-muted">No operational anomalies detected.</p>}
                        </div>
                    </section>

                    <section className="glass-panel">
                        <div className="section-header">
                            <h3>🏆 Big Wins (Last Hour)</h3>
                        </div>
                        <div className="activity-list">
                            {liveMetrics?.large_wins.length > 0 ? liveMetrics.large_wins.map((w, i) => (
                                <div key={i} className="log-entry log-success">
                                    <span>User: {w.userId}</span>
                                    <strong>+{w.amount} EUR</strong>
                                </div>
                            )) : <p className="text-muted">No big wins in the last hour.</p>}
                        </div>
                    </section>
                </div>

                <div className="side-column">
                    <section className="glass-panel">
                        <div className="section-header">
                            <h3>📉 Churn Alert (7d Inactive)</h3>
                        </div>
                        <div className="churn-list">
                            {churnRisks.length > 0 ? churnRisks.map((p, i) => (
                                <div key={i} className="bonus-card" style={{ marginBottom: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4>{p.userId}</h4>
                                        <p style={{ fontSize: '0.7rem' }}>Last activity: {new Date(p.lastSeen).toLocaleDateString()}</p>
                                    </div>
                                    <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.7rem' }}>Retain</button>
                                </div>
                            )) : <p className="text-muted">Retention is healthy.</p>}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default TenantPortal;
