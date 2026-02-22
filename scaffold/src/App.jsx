import React, { useState } from 'react';
import { useSession } from '@neostrike/sdk';
import { GameLobby } from './components/GameLobby';
import { WalletDrawer } from './components/WalletDrawer';
import { AlertModal } from './components/AlertModal';
import theme from '../theme.config';

function App() {
    const { player, login, isAuthenticated, logout } = useSession();
    const [isWalletOpen, setWalletOpen] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        login(username, 'password123'); // Demo password
    };

    return (
        <div className="app" style={{
            background: theme.colors.background,
            minHeight: '100vh',
            fontFamily: theme.fonts.body,
            color: theme.colors.text
        }}>
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
                                {player.username}
                            </div>
                            <button onClick={logout} style={{ background: 'none', border: 'none', color: theme.colors.primary, cursor: 'pointer' }}>Logout</button>
                        </>
                    ) : (
                        <form onSubmit={handleLogin} style={{ display: 'flex', gap: '10px' }}>
                            <input
                                name="username"
                                placeholder="Username"
                                defaultValue="demo_user"
                                style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
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

            <WalletDrawer isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} />
            <AlertModal />
        </div>
    );
}

export default App;
