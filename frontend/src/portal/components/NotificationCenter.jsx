import React, { useState } from 'react';
import useSWR from 'swr';
import { Bell, X, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const NotificationCenter = ({ token }) => {
    const [isOpen, setIsOpen] = useState(false);

    // SWR for stateless 30s polling as per PRD
    const { data: notifications, mutate } = useSWR(
        token ? ['/api/operator/notifications', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 30000 }
    );

    const unreadCount = notifications?.filter(n => n.status === 'unread').length || 0;

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'Critical': return <AlertTriangle color="#ff4d4d" size={16} />;
            case 'Warning': return <Info color="#ffcc00" size={16} />;
            default: return <CheckCircle color="#00ccff" size={16} />;
        }
    };

    return (
        <div className="notification-center-container">
            <div className="notification-bell-icon" onClick={() => setIsOpen(!isOpen)}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="pulse-badge"></span>}
            </div>

            {isOpen && (
                <div className="notification-drawer glass-panel">
                    <div className="drawer-header">
                        <h3>Operational Alerts</h3>
                        <X size={18} className="close-btn" onClick={() => setIsOpen(false)} />
                    </div>
                    <div className="notification-list">
                        {notifications?.length > 0 ? notifications.map(n => (
                            <div key={n.id} className={`notification-item ${n.status}`}>
                                <div className="severity-indicator">
                                    {getSeverityIcon(n.severity)}
                                </div>
                                <div className="notification-content">
                                    <p className="message">{n.message}</p>
                                    <div className="meta">
                                        <span className="type">{n.type}</span>
                                        <span className="dot">•</span>
                                        <span className="time">{new Date(n.created_at).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <p>No active alerts</p>
                                <span>Systems are healthy</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default NotificationCenter;
