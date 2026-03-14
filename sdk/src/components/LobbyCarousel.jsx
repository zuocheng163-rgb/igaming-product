import React, { useRef } from 'react';

const LobbyCarousel = ({ title, games, onGameClick, getTheme }) => {
    const scrollRef = useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollTo = direction === 'left' 
                ? scrollLeft - clientWidth * 0.8 
                : scrollLeft + clientWidth * 0.8;
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (!games || games.length === 0) return null;

    return (
        <div className="sdk-carousel-container" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5px' }}>{title}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => scroll('left')} style={arrowButtonStyle}>←</button>
                    <button onClick={() => scroll('right')} style={arrowButtonStyle}>→</button>
                </div>
            </div>

            <div 
                ref={scrollRef}
                style={{
                    display: 'flex',
                    gap: '16px',
                    overflowX: 'auto',
                    paddingBottom: '12px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollSnapType: 'x mandatory'
                }}
            >
                {games.map(game => {
                    const theme = getTheme ? getTheme(game) : { emoji: '🎮', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)' };
                    return (
                        <div
                            key={game.id}
                            onClick={() => onGameClick(game)}
                            style={{
                                flex: '0 0 160px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                scrollSnapAlign: 'start'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            }}
                        >
                            <div style={{
                                height: '100px',
                                background: theme.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.5rem'
                            }}>
                                {theme.emoji}
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {game.name}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                    {game.provider}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .sdk-carousel-container div::-webkit-scrollbar { display: none; }
            `}} />
        </div>
    );
};

const arrowButtonStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    transition: 'all 0.2s ease'
};

export default LobbyCarousel;
