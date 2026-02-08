import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TenantPortal from './components/TenantPortal';
import { login } from './services/api';
import { NeoStrikeProvider } from './sdk/hooks';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');

  const handleLogin = (token, userData) => {
    setUser(userData.user || userData); // Store the inner user object if available
    setToken(token);
    setError('');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  const renderContent = () => {
    if (!user) return <Login onLogin={handleLogin} />;

    // In PoC, anyone with 'admin' in their username or explicit role is redirected to Portal
    if (user.role === 'ADMIN' || user.username.toLowerCase().includes('admin')) {
      return <TenantPortal token={token} onLogout={handleLogout} />;
    }

    return <Dashboard user={user} token={token} onLogout={handleLogout} />;
  };

  return (
    <NeoStrikeProvider config={{ token, apiUrl: window.location.origin }}>
      <div className="app-container">
        {error && <div className="error-banner">{error}</div>}
        {renderContent()}
      </div>
    </NeoStrikeProvider>
  );
}

export default App;
