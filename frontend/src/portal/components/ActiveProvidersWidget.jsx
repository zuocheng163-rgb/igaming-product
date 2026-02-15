import React from 'react';
import { Gamepad2 } from 'lucide-react';

const ActiveProvidersWidget = () => {
    const providers = [
        { name: 'Evolution Gaming', initial: 'E', color: '#ff4d4d', active: true },
        { name: 'Pragmatic Play', initial: 'P', color: '#ffa500', active: true },
        { name: 'NetEnt', initial: 'N', color: '#9b59b6', active: true }
    ];

    return (
        <section className="glass-panel" style={{ padding: '20px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>Active Providers</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {providers.map((provider, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: provider.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            color: 'white'
                        }}>
                            {provider.initial}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>
                                {provider.name}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: provider.active ? '#00ff88' : '#ff4d4d',
                                boxShadow: provider.active ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none'
                            }} />
                            <span style={{
                                fontSize: '0.85rem',
                                color: provider.active ? '#00ff88' : '#ff4d4d',
                                fontWeight: '600'
                            }}>
                                {provider.active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ActiveProvidersWidget;
