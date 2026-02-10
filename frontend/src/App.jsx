import React, { useState, useEffect } from 'react';
import Login from './player/components/Login';
import Dashboard from './player/components/Dashboard';
import PortalDashboard from './portal/components/PortalDashboard';
import { NeoStrikeProvider } from './sdk/hooks';
import './index.css';
import './portal/portal.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');
  const [pathname, setPathname] = useState(window.location.pathname);

  // Simple path listener
  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogin = (token, userData) => {
    setUser(userData.user || userData);
    setToken(token);
    setError('');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  const renderContent = () => {
    const isPortal = pathname.startsWith('/portal');

    if (!user) {
      return (
        <div className="auth-container">
          {isPortal && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px 0',
              color: 'var(--accent-gold)',
              fontSize: '1.2rem',
              fontWeight: 700,
              letterSpacing: '2px'
            }}>
              OPERATOR COMMAND CENTER
            </div>
          )}
          <Login onLogin={handleLogin} />
        </div>
      );
    }

    if (isPortal) {
      return <PortalDashboard token={token} onLogout={handleLogout} />;
    }

    return <Dashboard user={user} token={token} onLogout={handleLogout} />;
  };

  return (
    <NeoStrikeProvider config={{ token, username: user?.username, apiUrl: window.location.origin }}>
      <div className="app-container">
        {error && <div className="error-banner">{error}</div>}
        {renderContent()}
      </div>
    </NeoStrikeProvider>
  );
}

export default App;
