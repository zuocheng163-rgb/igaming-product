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
                    {/* Category filters */}
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
                    {/* Search */}
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
                    No games found
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '16px',
                    padding: '16px 0'
                }}>
                    {games.map(game => (
                        <div
                            key={game.id}
                            onClick={() => handleLaunch(game)}
                            style={{
                                borderRadius: '10px',
                                overflow: 'hidden',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                opacity: launchingId === game.id ? 0.6 : 1
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'var(--primary, #00ccff)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,204,255,0.15)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Thumbnail */}
                            <div style={{ width: '100%', height: '110px', overflow: 'hidden', position: 'relative' }}>
                                {game.thumbnail ? (
                                    <img
                                        src={game.thumbnail}
                                        alt={game.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,204,255,0.05)', fontSize: '2.5rem' }}>
                                        🎰
                                    </div>
                                )}
                                {launchingId === game.id && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem' }}>
                                        Launching...
                                    </div>
                                )}
                            </div>
                            {/* Info */}
                            <div style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {game.name}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{PROVIDER_LABELS[game.provider] || game.provider}</span>
                                    {game.rtp && <span style={{ color: '#00ff88' }}>RTP {game.rtp}%</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default PlayerGameLobby;
