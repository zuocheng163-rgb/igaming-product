import React, { useState } from 'react';
import { useGames, useSession } from '@neostrike/sdk';
import theme from '../../theme.config';

const GameCard = ({ game, onLaunch }) => (
    <div className="game-card" style={{
        background: theme.colors.surface,
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s'
    }} onClick={() => onLaunch(game)}>
        <img src={game.thumbnail} alt={game.name} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
        <div style={{ padding: '12px', color: theme.colors.text }}>
            <div style={{ fontWeight: 'bold' }}>{game.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>{game.provider}</div>
        </div>
    </div>
);

export const GameLobby = () => {
    const { player, isAuthenticated } = useSession();
    const { games, loading, error, search, filter, loadMore } = useGames();
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        search(e.target.value);
    };

    const handleLaunch = async (game) => {
        if (!isAuthenticated) {
            alert('Please login to play');
            return;
        }

        try {
            // In a real app, this would be handled via the SDK or a direct API call
            const response = await fetch(`${process.env.VITE_NEOSTRIKE_API_URL}/api/v1/games/${game.id}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-brand-id': '1'
                },
                body: JSON.stringify({ player_id: player.user_id, mode: 'real' })
            });
            const data = await response.json();
            window.open(data.game_url, '_blank');
        } catch (err) {
            console.error('Failed to launch game', err);
        }
    };

    return (
        <div className="game-lobby" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Search games..."
                    value={searchTerm}
                    onChange={handleSearch}
                    style={{
                        padding: '10px',
                        borderRadius: '4px',
                        border: 'none',
                        flex: 1,
                        background: theme.colors.surface,
                        color: theme.colors.text
                    }}
                />
                <select
                    onChange={(e) => filter({ category: e.target.value })}
                    style={{ padding: '10px', borderRadius: '4px', border: 'none', background: theme.colors.surface, color: theme.colors.text }}
                >
                    <option value="">All Categories</option>
                    <option value="slots">Slots</option>
                    <option value="live-casino">Live Casino</option>
                </select>
            </div>

            {loading && <div style={{ color: theme.colors.text }}>Loading games...</div>}
            {error && <div style={{ color: '#ff4444' }}>Error: {error.message}</div>}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '20px'
            }}>
                {games.map(game => (
                    <GameCard key={game.id} game={game} onLaunch={handleLaunch} />
                ))}
            </div>

            {games.length > 0 && (
                <button
                    onClick={loadMore}
                    style={{
                        marginTop: '20px',
                        padding: '10px 20px',
                        background: theme.colors.primary,
                        color: '#white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Load More
                </button>
            )}
        </div>
    );
};
