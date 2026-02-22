import React, { useState, useEffect, useCallback } from 'react';

const PROVIDER_LABELS = {
    evolution: 'Evolution',
    pragmatic: 'Pragmatic Play',
    netent: 'NetEnt'
};

const CATEGORY_LABELS = {
    'slots': '🎰 Slots',
    'live-casino': '🎥 Live Casino',
    'table-games': '♟️ Table Games'
};

// Per-game themed gradient + emoji icon — no broken external images
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

const DEFAULT_LIVE = { emoji: '🎥', gradient: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)' };
const DEFAULT_SLOT = { emoji: '🎰', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)' };

function getTheme(game) {
    return GAME_THEMES[game.id] || (game.category === 'live-casino' ? DEFAULT_LIVE : DEFAULT_SLOT);
}

function PlayerGameLobby({ token, user, onStatusUpdate }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [launchingId, setLaunchingId] = useState(null);

    const fetchGames = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (activeCategory !== 'all') params.set('category', activeCategory);

            const res = await fetch(`/api/v1/games/catalog?${params}`, {
                headers: { 'x-brand-id': '1' }
            });
            const data = await res.json();
            setGames(data.games || []);
        } catch (err) {
            console.error('Failed to load games', err);
        } finally {
            setLoading(false);
        }
    }, [search, activeCategory]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    const handleLaunch = async (game) => {
        if (!user?.user_id) {
            onStatusUpdate?.('Please log in to play games');
            return;
        }

        setLaunchingId(game.id);
        try {
            const res = await fetch(`/api/v1/games/${game.id}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-brand-id': '1'
                },
                body: JSON.stringify({ player_id: user.user_id, mode: 'real' })
            });
            const data = await res.json();
            if (data.game_url) {
                window.open(data.game_url, '_blank');
                onStatusUpdate?.(`Launching ${game.name}...`);
            }
        } catch (err) {
            onStatusUpdate?.('Failed to launch game');
        } finally {
            setLaunchingId(null);
        }
    };

    const categories = ['all', 'slots', 'live-casino'];

    return (
        <section className="glass-panel" style={{ marginTop: '24px' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3>🎮 Game Lobby</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: 'none',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                fontWeight: activeCategory === cat ? 700 : 400,
                                background: activeCategory === cat
                                    ? 'var(--primary, #00ccff)'
                                    : 'rgba(255,255,255,0.08)',
                                color: activeCategory === cat ? '#000' : 'var(--text-muted, #aaa)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {cat === 'all' ? '🌐 All' : CATEGORY_LABELS[cat] || cat}
                        </button>
                    ))}
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            fontSize: '0.85rem',
                            width: '160px',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading games...
                </div>
            ) : games.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No games available in your lobby
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '16px',
                    padding: '16px 0'
                }}>
                    {games.map(game => {
                        const theme = getTheme(game);
                        return (
                            <div
                                key={game.id}
                                onClick={() => handleLaunch(game)}
                                style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: launchingId === game.id ? 0.6 : 1
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Game Art: Gradient + Big Emoji */}
                                <div style={{
                                    width: '100%',
                                    height: '110px',
                                    background: theme.gradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '3rem',
                                    position: 'relative'
                                }}>
                                    {theme.emoji}
                                    {/* RTP badge top-right */}
                                    {game.rtp && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '6px',
                                            right: '8px',
                                            fontSize: '0.65rem',
                                            background: 'rgba(0,0,0,0.5)',
                                            color: '#00ff88',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: 700
                                        }}>
                                            {game.rtp}%
                                        </span>
                                    )}
                                    {launchingId === game.id && (
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'rgba(0,0,0,0.6)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontSize: '0.8rem', fontWeight: 700
                                        }}>
                                            Launching...
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)' }}>
                                    <div style={{
                                        fontWeight: 700, fontSize: '0.85rem', marginBottom: '3px',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {game.name}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {PROVIDER_LABELS[game.provider] || game.provider}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default PlayerGameLobby;
