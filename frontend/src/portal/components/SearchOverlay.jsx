import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, CreditCard, History, Loader2 } from 'lucide-react';
import axios from 'axios';

const SearchOverlay = ({ isOpen, onClose, token }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState(() => {
        const saved = localStorage.getItem('ns_recent_searches');
        return saved ? JSON.parse(saved) : [];
    });
    const inputRef = useRef(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isOpen]);

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults(null);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await axios.get(`/api/operator/search?q=${query}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setResults(res.data);
            } catch (err) {
                console.error('Search failed');
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, token]);

    const handleSelect = (item, type) => {
        if (type === 'players') {
            const searchQuery = item.user_id || item.username;
            // Force hard navigation to ensure consistent behavior
            const targetUrl = `${window.location.origin}/portal/players?search=${encodeURIComponent(searchQuery)}`;
            window.location.href = targetUrl;
            return;
        }

        const newRecent = [
            { id: item.user_id || item.transaction_id, label: item.username || item.transaction_id, type },
            ...recent.filter(r => r.id !== (item.user_id || item.transaction_id))
        ].slice(0, 5);

        setRecent(newRecent);
        localStorage.setItem('ns_recent_searches', JSON.stringify(newRecent));
        if (type !== 'players') onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="search-overlay-backdrop" onClick={onClose}>
            <div className="search-modal" onClick={e => e.stopPropagation()} style={{ background: '#1a1d24', border: '1px solid var(--glass-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}>
                <div className="search-header">
                    <Search size={20} className="search-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search players, transactions, events..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <kbd className="kbd-hint">ESC</kbd>
                    <X size={20} className="close-btn" onClick={onClose} />
                </div>

                <div className="search-body">
                    {loading && (
                        <div className="search-loading">
                            <Loader2 className="animate-spin" />
                            <span>Searching NeoStrike indexing...</span>
                        </div>
                    )}

                    {!loading && !results && recent.length > 0 && (
                        <div className="search-section">
                            <label><History size={14} /> Recent Searches</label>
                            {recent.map((r, i) => (
                                <div key={i} className="search-item" onClick={() => onClose()}>
                                    <span className="item-icon">{r.type === 'player' ? <User size={14} /> : <CreditCard size={14} />}</span>
                                    <span className="item-label">{r.label}</span>
                                    <span className="item-meta">{r.type}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && results && (
                        <>
                            {results.players.length > 0 && (
                                <div className="search-section">
                                    <label>Players</label>
                                    {results.players.map(p => (
                                        <div key={p.user_id} className="search-item" onClick={() => handleSelect(p, 'player')}>
                                            <User size={14} className="item-icon" />
                                            <div className="item-info">
                                                <span className="item-label">{p.username}</span>
                                                <span className="item-subtext">{p.email}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {results.transactions.length > 0 && (
                                <div className="search-section">
                                    <label>Transactions</label>
                                    {results.transactions.map(t => (
                                        <div key={t.id} className="search-item" onClick={() => handleSelect(t, 'transaction')}>
                                            <CreditCard size={14} className="item-icon" />
                                            <div className="item-info">
                                                <span className="item-label">{t.transaction_id}</span>
                                                <span className="item-subtext">Player: {t.user_id}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {results.players.length === 0 && results.transactions.length === 0 && (
                                <div className="no-results">No matches found for "{query}"</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchOverlay;
