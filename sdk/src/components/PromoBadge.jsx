import React from 'react';

const PromoBadge = ({ promotion }) => {
    if (!promotion) return null;

    const getColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'bonus': return '#ffd700'; // Gold
            case 'freespins': return '#00ccff'; // Blue
            case 'cashback': return '#00ff88'; // Green
            default: return 'var(--primary, #00ccff)';
        }
    };

    return (
        <div 
            className="sdk-promo-badge"
            style={{
                background: `linear-gradient(90deg, ${getColor(promotion.type)} 0%, rgba(255,255,255,0.1) 100%)`,
                color: '#000',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)'
            }}
        >
            <span style={{ fontSize: '0.8rem' }}>🎁</span>
            {promotion.label || promotion.name || 'HOT'}
        </div>
    );
};

export default PromoBadge;
