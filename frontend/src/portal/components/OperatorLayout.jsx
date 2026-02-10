import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Wallet,
    Gamepad2,
    ShieldAlert,
    Settings,
    Bell,
    Search,
    Calendar,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const OperatorLayout = ({ children, user, onLogout }) => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
        { icon: Users, label: 'Players', id: 'players' },
        { icon: Wallet, label: 'Wallet', id: 'wallet' },
        { icon: Gamepad2, label: 'Games', id: 'games' },
        { icon: ShieldAlert, label: 'Compliance', id: 'compliance' },
        { icon: Settings, label: 'Settings', id: 'settings' },
    ];

    return (
        <div className="operator-portal-root">
            {/* Floating Global Header */}
            <header className="portal-header glass-panel floating">
                <div className="header-left">
                    <div className="omnisearch-wrapper">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search players, TXs... (Ctrl+K)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="header-right">
                    <div className="date-selector glass-panel">
                        <Calendar size={16} />
                        <span>Last 30 Days</span>
                    </div>

                    <div className="notification-bell">
                        <Bell size={20} />
                        <span className="pulse-badge"></span>
                    </div>

                    <div className="user-profile" onClick={onLogout}>
                        <div className="user-info">
                            <span className="user-name">{user?.username || 'Operator'}</span>
                            <span className="user-role">Administrator</span>
                        </div>
                        <div className="avatar">OP</div>
                    </div>
                </div>
            </header>

            <div className="portal-container">
                {/* Persistent Left Sidebar */}
                <aside className={`portal-sidebar glass-panel ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                    <div className="sidebar-header">
                        <h1 className="logo-text">NS.<span>Portal</span></h1>
                        <button
                            className="collapse-btn"
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        >
                            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    <nav className="sidebar-nav">
                        {navItems.map((item) => (
                            <div key={item.id} className="nav-item">
                                <item.icon className="nav-icon" size={20} />
                                {!isSidebarCollapsed && <span className="nav-label">{item.label}</span>}
                            </div>
                        ))}
                    </nav>

                    <div className="sidebar-footer">
                        {!isSidebarCollapsed && (
                            <div className="system-status">
                                <div className="status-dot online"></div>
                                <span>System Online</span>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="portal-main">
                    <div className="content-breadcrumbs">
                        <span>Dashboard</span>
                    </div>
                    {children}
                </main>
            </div>

        </div>
    );
};

export default OperatorLayout;
