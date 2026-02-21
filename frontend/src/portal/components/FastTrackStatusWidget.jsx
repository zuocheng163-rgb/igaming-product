import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle, AlertCircle } from 'lucide-react';

const FastTrackStatusWidget = ({ token, stats, onClick, periodLabel = '24h' }) => {
    const eventsSentValue = stats?.metrics?.events_sent?.value || 0;

    const [status, setStatus] = useState({
        connected: true,
        eventsSent: eventsSentValue,
        lastSync: new Date(),
        health: 'good' // good, warning, error
    });

    useEffect(() => {
        if (stats?.metrics?.events_sent?.value) {
            setStatus(prev => ({ ...prev, eventsSent: stats.metrics.events_sent.value }));
        }
    }, [stats]);

    useEffect(() => {
        // Update last sync time every second
        const interval = setInterval(() => {
            setStatus(prev => ({
                ...prev,
                lastSync: new Date()
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const getTimeSinceSync = () => {
        const seconds = Math.floor((new Date() - status.lastSync) / 1000);
        if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    };

    // Calculate progress percentage (example: based on events sent)
    const progressPercentage = Math.min((status.eventsSent / 15000) * 100, 100);

    return (
        <section className="glass-panel" style={{ padding: '20px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Zap size={24} style={{ color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white', marginBottom: '4px' }}>
                        Fast Track Integration Status
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {status.connected ? (
                            <>
                                <CheckCircle size={16} style={{ color: '#00ff88' }} />
                                <span style={{ color: '#00ff88', fontSize: '0.9rem', fontWeight: '600' }}>Connected</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={16} style={{ color: '#ff4d4d' }} />
                                <span style={{ color: '#ff4d4d', fontSize: '0.9rem', fontWeight: '600' }}>Disconnected</span>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>LAST SYNC</div>
                    <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600' }}>{getTimeSinceSync()}</div>
                </div>
            </div>

            <div style={{ marginTop: '24px' }}>
                <div
                    onClick={onClick}
                    style={{ cursor: onClick ? 'pointer' : 'default', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => onClick && (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => onClick && (e.currentTarget.style.opacity = '1')}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Events Sent ({periodLabel})</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'white', marginBottom: '16px' }}>
                        {status.eventsSent.toLocaleString()}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ position: 'relative', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${progressPercentage}%`,
                        background: 'linear-gradient(90deg, #00d4ff 0%, #00ff88 100%)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* Status Indicators */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ff4d4d',
                        boxShadow: '0 0 8px rgba(255, 77, 77, 0.5)'
                    }} />
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ffa500',
                        boxShadow: '0 0 8px rgba(255, 165, 0, 0.5)'
                    }} />
                </div>
            </div>
        </section>
    );
};

export default FastTrackStatusWidget;
