import React from 'react';

const FilterBar = ({ 
    filters, 
    setSearch, 
    setCategory, 
    setProvider, 
    categories = ['all', 'slots', 'live-casino'],
    providers = []
}) => {
    return (
        <div className="sdk-filter-bar" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: 'none',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            fontWeight: filters.category === cat ? 700 : 400,
                            background: filters.category === cat
                                ? 'var(--primary, #00ccff)'
                                : 'rgba(255,255,255,0.08)',
                            color: filters.category === cat ? '#000' : 'var(--text-white, #fff)',
                            transition: 'all 0.2s ease',
                            textTransform: 'capitalize'
                        }}
                    >
                        {cat === 'all' ? '🌐 All Games' : cat.replace('-', ' ')}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {providers.length > 0 && (
                    <select 
                        value={filters.provider}
                        onChange={(e) => setProvider(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.1)',
                            outline: 'none',
                            fontSize: '0.85rem'
                        }}
                    >
                        <option value="">All Providers</option>
                        {providers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
                
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={filters.search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            padding: '8px 16px 8px 36px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            fontSize: '0.85rem',
                            width: '200px',
                            outline: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    />
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.5,
                        fontSize: '0.9rem'
                    }}>🔍</span>
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
