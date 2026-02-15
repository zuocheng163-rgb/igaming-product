import React from 'react';
import useSWR from 'swr';
import { Bell, Clock, AlertTriangle, CreditCard, ShieldCheck } from 'lucide-react';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const NotificationsWidget = ({ token }) => {
    const { data: notifications } = useSWR(
        token ? ['/api/operator/notifications', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 30000 }
    );

    const recentNotifications = (notifications || []).slice(0, 3);

    const getIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'payment': return <CreditCard size={16} />;
            case 'kyc': return <ShieldCheck size={16} />;
            case 'security': return <AlertTriangle size={16} />;
            default: return <Bell size={16} />;
        }
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <section className="glass-panel" style={{ padding: '20px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>Notifications</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {notifications && notifications.filter(n => n.status === 'unread').length > 0 && (
                        <span style={{
                            background: 'rgba(255, 77, 77, 0.2)',
                            color: '#ff4d4d',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                        }}>
                            {notifications.filter(n => n.status === 'unread').length} New
                        </span>
                    )}
                    <button
                        className="btn-link"
                        style={{ fontSize: '0.85rem', color: 'var(--primary)' }}
                        onClick={() => {
                            // Trigger notification center
                            document.querySelector('.notification-bell-icon')?.click();
                        }}
                    >
                        View All
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentNotifications.length > 0 ? recentNotifications.map((notif, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '12px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: `1px solid ${notif.severity === 'Critical' ? 'rgba(255, 77, 77, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ color: notif.severity === 'Critical' ? '#ff4d4d' : '#ffd700', marginTop: '2px' }}>
                                {getIcon(notif.type)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                                    {notif.message || notif.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={10} />
                                    {formatTimeAgo(notif.timestamp || notif.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        <Bell size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>No recent notifications</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default NotificationsWidget;
