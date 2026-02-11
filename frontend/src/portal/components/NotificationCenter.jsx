import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
    Bell, X, CheckCircle, Info, AlertTriangle,
    CreditCard, ShieldCheck, Zap, Settings,
    Filter, Trash2, Check, Clock
} from 'lucide-react';

const fetcher = (url, token) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

const NotificationCenter = ({ token }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [showPrefs, setShowPrefs] = useState(false);

    const { data: notifications, mutate } = useSWR(
        token ? ['/api/operator/notifications', token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 30000 }
    );

    const filteredNotifications = useMemo(() => {
        if (!notifications) return [];
        let list = [...notifications];

        // Sorting: Critical first, then by date
        list.sort((a, b) => {
            if (a.severity === 'Critical' && b.severity !== 'Critical') return -1;
            if (a.severity !== 'Critical' && b.severity === 'Critical') return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        if (activeFilter === 'unread') return list.filter(n => n.status === 'unread');
        return list;
    }, [notifications, activeFilter]);

    const unreadCount = notifications?.filter(n => n.status === 'unread').length || 0;

    const getIcon = (type, severity) => {
        if (severity === 'Critical') return <AlertTriangle className="text-red-500" size={16} />;

        switch (type?.toLowerCase()) {
            case 'payment': return <CreditCard size={16} />;
            case 'kyc': return <ShieldCheck size={16} />;
            case 'security': return <Zap size={16} />;
            default: return <Info size={16} />;
        }
    };

    const handleResolve = (id) => {
        // Optimistic UI update
        mutate(notifications.map(n => n.id === id ? { ...n, status: 'read' } : n), false);
        // axios.post(`/api/operator/notifications/${id}/resolve`, {}, { headers: { Authorization: `Bearer ${token}` } });
    };

    const formatTimeAgo = (dateStr) => {
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(dateStr).toLocaleDateString();
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
                        <div className="header-title">
                            <h3>Operational Alerts</h3>
                            {unreadCount > 0 && <span className="count-badge">{unreadCount}</span>}
                        </div>
                        <div className="header-actions">
                            <Settings size={16} className="btn-icon" onClick={() => setShowPrefs(!showPrefs)} />
                            <X size={18} className="btn-icon" onClick={() => setIsOpen(false)} />
                        </div>
                    </div>

                    <div className="drawer-filters">
                        <button
                            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('all')}
                        >All</button>
                        <button
                            className={`filter-tab ${activeFilter === 'unread' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('unread')}
                        >Unread</button>
                        <div className="flex-grow"></div>
                        <span className="clear-all"><Trash2 size={12} /> Clear</span>
                    </div>

                    {showPrefs && (
                        <div className="prefs-panel glass-panel">
                            <h4>Notification Preferences</h4>
                            <div className="pref-item">
                                <span>Security Alerts</span>
                                <input type="checkbox" defaultChecked />
                            </div>
                            <div className="pref-item">
                                <span>Payment Failures</span>
                                <input type="checkbox" defaultChecked />
                            </div>
                            <div className="pref-item">
                                <span>KYC Verification</span>
                                <input type="checkbox" defaultChecked />
                            </div>
                        </div>
                    )}

                    <div className="notification-list">
                        {filteredNotifications.length > 0 ? filteredNotifications.map(n => (
                            <div key={n.id} className={`notification-item ${n.status} ${n.severity?.toLowerCase()}`}>
                                <div className="severity-indicator">
                                    {getIcon(n.type, n.severity)}
                                </div>
                                <div className="notification-content">
                                    <div className="msg-row">
                                        <p className="message">{n.message}</p>
                                        {n.status === 'unread' && (
                                            <button className="resolve-btn" onClick={() => handleResolve(n.id)}>
                                                <Check size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="meta">
                                        <span className="type">{n.type || 'System'}</span>
                                        <span className="dot">•</span>
                                        <span className="time"><Clock size={10} style={{ marginRight: '4px' }} /> {formatTimeAgo(n.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <CheckCircle size={32} className="text-green-500" />
                                <p>All Systems Nominal</p>
                                <span>No active alerts detected in the stream</span>
                            </div>
                        )}
                    </div>

                    <div className="drawer-footer">
                        <button className="view-all">Open Alert Console</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
