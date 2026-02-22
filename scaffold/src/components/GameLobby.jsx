import React, { useState } from 'react';
import { useGames, useSession } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import { GameLauncher } from './GameLauncher';
import theme from '../../theme.config';

// Shared per-game visual identity (Synced with Operator Portal)
const GAME_THEMES = {
    'evolution:lightning-roulette': { emoji: '🎡', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #b8860b 100%)' },
    'evolution:crazy-time': { emoji: '🎪', gradient: 'linear-gradient(135deg, #6a0dad 0%, #c70039 60%, #ff5733 100%)' },
    'pragmatic:gates-of-olympus': { emoji: '🏛️', gradient: 'linear-gradient(135deg, #0f3460 0%, #533483 60%, #e94560 100%)' },
    'pragmatic:sweet-bonanza': { emoji: '🍭', gradient: 'linear-gradient(135deg, #c0392b 0%, #e67e22 60%, #f1c40f 100%)' },
    'pragmatic:wolf-gold': { emoji: '🐺', gradient: 'linear-gradient(135deg, #0d0d0d 0%, #1c1c3a 60%, #b8860b 100%)' },
    'netent:starburst': { emoji: '💎', gradient: 'linear-gradient(135deg, #4a00e0 0%, #8e2de2 60%, #00c6ff 100%)' },
    'netent:gonzos-quest': { emoji: '🌴', gradient: 'linear-gradient(135deg, #134e5e 0%, #11998e 60%, #b8860b 100%)' },
    'netent:divine-fortune': { emoji: '🐴', gradient: 'linear-gradient(135deg, #8B0000 0%, #4b134f 60%, #b8860b 100%)' },
};

const GameCard = ({ game, onLaunch }) => {
    const theme_ = GAME_THEMES[game.id] || { emoji: '🎮', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)' };

    return (
        <div
            className="game-card"
            style={{
                background: 'linear-gradient(145deg, #1e1e2d 0%, #161625 100%)',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.boxShadow = `0 10px 20px ${theme.colors.primary}22`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => onLaunch(game)}
        >
            <div style={{
                height: '140px',
                background: theme_.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '50px',
                position: 'relative'
            }}>
                <span>{theme_.emoji}</span>
                <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)',
                    fontSize: '10px', color: '#fff', fontWeight: 'bold'
                }}>
                    {game.provider.split(':')[0].toUpperCase()}
                </div>
            </div>
            <div style={{ padding: '15px' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {game.name}
                </div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {game.category?.replace('-', ' ') || 'Classic Slot'}
                </div>
            </div>
        </div>
    );
};

export const GameLobby = () => {
    const { player, isAuthenticated } = useSession();
    const { games, loading, error, search, filter, loadMore, total } = useGames();
    const [activeCategory, setActiveCategory] = useState('');
    const [launchState, setLaunchState] = useState({ game: null, url: null });

    const categories = [
        { label: 'All Games', value: '' },
        { label: '🔥 Popular', value: 'popular' },
        { label: '🎰 Slots', value: 'slots' },
        { label: '🎡 Live Casino', value: 'live-casino' },
        { label: '🃏 Table Games', value: 'table' }
    ];

    const handleCategoryChange = (val) => {
        setActiveCategory(val);
        filter({ category: val });
        logSDKEvent('UI', `Category changed to: ${val || 'All'}`);
    };

    const handleLaunch = async (game) => {
        if (!isAuthenticated) {
            logSDKEvent('UI', 'Unauthenticated launch. Failover to Simulation Mode.');
            setLaunchState({ game, url: null });
            return;
        }

        logSDKEvent('UI', `Launching game: ${game.name}...`);
        try {
            const apiUrl = import.meta.env.VITE_NEOSTRIKE_API_URL;
            const apiKey = import.meta.env.VITE_NEOSTRIKE_API_KEY;

            const response = await fetch(`${apiUrl}/api/v1/games/${game.id}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'x-brand-id': '1'
                },
                body: JSON.stringify({ player_id: player.user_id, mode: 'real' })
            });

            if (!response.ok) throw new Error('Launch request failed');

            const data = await response.json();
            setLaunchState({ game, url: data.game_url });
            logSDKEvent('SDK', 'Game launch URL received', { url: data.game_url });
        } catch (err) {
            logSDKEvent('ERROR', `Launch failed: ${err.message}. Failover to Simulation Mode.`);
            // Auto-launch simulation if real fails, for better demo flow
            setLaunchState({ game, url: null });
            logSDKEvent('UI', `Launching ${game.name} in Simulation Mode (Automatic Failover)`);
        }
    };

    return (
        <div className="game-lobby" style={{ padding: '40px' }}>
            {/* Search and Filters */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '20px',
                marginBottom: '40px', background: 'rgba(255,255,255,0.02)',
                padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search for your favorite games..."
                        onChange={(e) => search(e.target.value)}
                        style={{
                            width: '100%', padding: '16px 20px', borderRadius: '12px',
                            background: '#0a0a0f', border: '1px solid #333',
                            color: '#fff', fontSize: '16px', boxSizing: 'border-box',
                            outline: 'none', transition: 'border-color 0.3s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = theme.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = '#333'}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {categories.map(cat => (
                        <button
                            key={cat.value}
                            onClick={() => handleCategoryChange(cat.value)}
                            style={{
                                padding: '8px 20px', borderRadius: '20px',
                                background: activeCategory === cat.value ? theme.colors.primary : 'rgba(255,255,255,0.05)',
                                color: '#fff', border: 'none', cursor: 'pointer',
                                whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Info */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '20px'
            }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>
                    {activeCategory ? categories.find(c => c.value === activeCategory).label.split(' ')[1] : 'All Games'}
                </h2>
                <span style={{ color: '#666', fontSize: '14px' }}>Showing {games.length} of {total} games</span>
            </div>

            {/* Error State */}
            {error && (
                <div style={{
                    padding: '20px', background: '#ff444422', border: '1px solid #ff4444',
                    borderRadius: '8px', color: '#ff4444', marginBottom: '20px'
                }}>
                    <strong>Load Error:</strong> {error}
                </div>
            )}

            {/* Games Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '24px'
            }}>
                {games.map(game => (
                    <GameCard key={game.id} game={game} onLaunch={handleLaunch} />
                ))}
            </div>

            {/* Loading / Infinite Scroll */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                {loading ? (
                    <div className="spinner" style={{ color: theme.colors.primary }}>Loading...</div>
                ) : games.length < total && (
                    <button
                        onClick={loadMore}
                        style={{
                            padding: '12px 40px', borderRadius: '8px',
                            background: 'transparent', color: theme.colors.primary,
                            border: `2px solid ${theme.colors.primary}`,
                            cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = theme.colors.primary;
                            e.target.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.color = theme.colors.primary;
                        }}
                    >
                        Load More Games
                    </button>
                )}
            </div>

            {/* Launch Overlay */}
            {launchState.game && (
                <GameLauncher
                    game={launchState.game}
                    launchUrl={launchState.url}
                    onClose={() => setLaunchState({ game: null, url: null })}
                />
            )}
        </div>
    );
};

