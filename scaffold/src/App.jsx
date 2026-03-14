import React, { useState } from 'react';
import { useSession, NeoStrikeProvider } from '@neostrike/sdk';
import { GameLobby } from './components/GameLobby';
import { WalletDrawer } from './components/WalletDrawer';
import { AlertModal } from './components/AlertModal';
import { SDKConsole } from './components/SDKConsole';
import { OfflineState, InstallPrompt } from '@neostrike/sdk';
import theme from '../theme.config';

function App() {
    const { player, login, isAuthenticated, logout } = useSession();
    const [isWalletOpen, setWalletOpen] = useState(false);
    const [token, setToken] = useState(localStorage.getItem('ns_session_token') || '');
    const [username, setUsername] = useState(localStorage.getItem('ns_username') || '');

    const handleLogin = async (e) => {
        e.preventDefault();
        const u = e.target.username.value;
        const t = e.target.token.value;
        try {
            await login(u, t);
            setToken(t);
            setUsername(u);
            localStorage.setItem('ns_session_token', t);
            localStorage.setItem('ns_username', u);
        } catch (err) {
            console.error('Login failed', err);
        }
    };

    const handleLogout = () => {
        logout();
        setToken('');
        setUsername('');
        localStorage.removeItem('ns_session_token');
        localStorage.removeItem('ns_username');
    };

    const config = {
        apiUrl: import.meta.env.VITE_NEOSTRIKE_API_URL,
        token: token,
        username: username,
        brandId: '1'
    };

    return (
        <NeoStrikeProvider config={config}>
            <div className="app" style={{
                background: theme.colors.background,
                minHeight: '100vh',
                fontFamily: theme.fonts.body,
                color: theme.colors.text
            }}>
                <OfflineState />
                <InstallPrompt />
                
                <header style={{
                    padding: '10px 40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: theme.colors.surface,
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <h1 style={{ margin: 0, fontSize: '24px', color: theme.colors.primary }}>{theme.casinoName}</h1>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        {isAuthenticated ? (
                            <>
                                <div
                                    onClick={() => setWalletOpen(true)}
                                    style={{ cursor: 'pointer', padding: '8px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px' }}
                                >
                                    {player?.username || username}
                                </div>
                                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: theme.colors.primary, cursor: 'pointer' }}>Logout</button>
                            </>
                        ) : (
                            <form onSubmit={handleLogin} style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    name="username"
                                    placeholder="Username"
                                    defaultValue="test01"
                                    style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff', width: '120px' }}
                                />
                                <input
                                    name="token"
                                    placeholder="Session Token"
                                    defaultValue="token-test01-1770476176796"
                                    style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff', width: '180px' }}
                                />
                                <button
                                    type="submit"
                                    style={{ padding: '8px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Login
                                </button>
                            </form>
                        )}
                    </div>
                </header>

                <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <GameLobby />
                </main>

                <WalletDrawer isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} player={player} />
                <AlertModal />
                <SDKConsole />
            </div>
        </NeoStrikeProvider>
    );
}

export default App;
