import React, { useState, useEffect, useRef } from 'react';
import { subscribeToSDK } from '@neostrike/sdk/src/utils';

export const SDKConsole = () => {
    const [events, setEvents] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('ALL');
    const scrollRef = useRef(null);

    useEffect(() => {
        const unsubscribe = subscribeToSDK((event) => {
            setEvents(prev => [...prev.slice(-49), event]); // Keep last 50 events
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events]);

    const filteredEvents = filter === 'ALL' ? events : events.filter(e => e.type === filter);

    const getEventColor = (type) => {
        switch (type) {
            case 'ERROR': return '#ff4d4d';
            case 'AUTH': return '#00d4ff';
            case 'WALLET': return '#00ff88';
            case 'PAYMENT': return '#ffcc00';
            case 'GAMES': return '#bc13fe';
            case 'SDK': return '#fff'; // Added for simulation
            case 'INTERVENTION': return '#ff8c00'; // Added for simulation
            default: return '#fff';
        }
    };

    const clearLogs = () => setEvents([]);

    const runSimulation = () => {
        logSDKEvent('AUTH', 'Simulation: Session verified for test01');
        setTimeout(() => logSDKEvent('SDK', 'Fetch game catalog success (200 OK)'), 400);
        setTimeout(() => logSDKEvent('GAMES', 'Game selected: Gonzo\'s Quest'), 800);
        setTimeout(() => logSDKEvent('WALLET', 'Bet request sent: -10.00 EUR'), 1200);
        setTimeout(() => logSDKEvent('WALLET', 'Win notification received: +25.00 EUR'), 1600);
        setTimeout(() => {
            logSDKEvent('INTERVENTION', 'Simulating Responsible Gaming threshold breach');
            window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
                detail: {
                    title: 'Gaming Activity Check',
                    message: 'You have been playing for a while. We recommend reviewing your limits.',
                    severity: 'info'
                }
            }));
        }, 2200);
    };

    if (!isOpen) {
        return (
            <div
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    background: '#1a1a2e', color: '#00d4ff', padding: '10px 20px',
                    borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '1px solid #00d4ff',
                    zIndex: 9999, fontSize: '13px'
                }}
            >
                📟 SDK Console ({events.length})
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: '20px', right: '20px',
            width: '600px', height: '400px', background: '#0a0a0f',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999,
            fontFamily: 'monospace'
        }}>
            <div style={{
                padding: '12px 20px', background: '#1a1a2e',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid #333'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📟</span>
                    <strong style={{ fontSize: '13px', letterSpacing: '1px', color: '#fff' }}>NEOSTRIKE SDK ACTIVITY</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={clearLogs} style={{
                        background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #444',
                        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                    }}>CLEAR</button>
                    <button onClick={() => setIsOpen(false)} style={{
                        background: 'none', border: 'none', color: '#666', fontSize: '20px', cursor: 'pointer'
                    }}>×</button>
                </div>
            </div>

            {/* Simulation Suite */}
            <div style={{ padding: '10px', background: '#16213e', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#888', fontWeight: 'bold' }}>SIMULATION SUITE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    <button onClick={runSimulation} style={{ background: '#00ff8822', color: '#00ff88', border: '1px solid #00ff88', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                        🚀 FULL STORYBOARD
                    </button>
                    <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
                            detail: { title: 'Reality Check', message: 'You have been playing for 60 minutes.', severity: 'info' }
                        }));
                    }} style={{ background: '#00d4ff22', color: '#00d4ff', border: '1px solid #00d4ff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                        ℹ️ INFO ALERT
                    </button>
                    <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
                            detail: { title: 'Session Warning', message: 'Your session will expire in 5 minutes due to limit.', severity: 'warning' }
                        }));
                    }} style={{ background: '#ffaa0022', color: '#ffaa00', border: '1px solid #ffaa00', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                        ⚠️ WARNING
                    </button>
                    <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
                            detail: { title: 'Self-Exclusion Active', message: 'You have been blocked from gaming activity.', severity: 'critical', buttonText: 'EXIT PLATFORM' }
                        }));
                    }} style={{ background: '#ff444422', color: '#ff4444', border: '1px solid #ff4444', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                        🛑 CRITICAL
                    </button>
                </div>
            </div>

            <div style={{ padding: '8px', display: 'flex', gap: '5px', background: '#0f3460' }}>
                {['ALL', 'AUTH', 'WALLET', 'PAYMENT', 'GAMES', 'ERROR', 'SDK', 'INTERVENTION'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                            background: filter === f ? '#00d4ff' : 'transparent',
                            color: filter === f ? '#000' : '#888',
                            border: `1px solid ${filter === f ? '#00d4ff' : '#444'}`,
                            cursor: 'pointer'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div ref={scrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '10px',
                display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
                {filteredEvents.length === 0 && (
                    <div style={{ color: '#444', textAlign: 'center', marginTop: '100px' }}>
                        Waiting for SDK interaction...
                    </div>
                )}
                {filteredEvents.map(event => (
                    <div key={event.id} style={{
                        fontSize: '11px', borderLeft: `3px solid ${getEventColor(event.type)}`,
                        paddingLeft: '8px', marginBottom: '4px'
                    }}>
                        <div style={{ color: '#666', fontSize: '9px' }}>
                            {event.timestamp.split('T')[1].split('.')[0]} | {event.type}
                        </div>
                        <div style={{ color: getEventColor(event.type) }}>{event.message}</div>
                        {event.data && (
                            <pre style={{
                                background: 'rgba(255,255,255,0.05)', padding: '5px',
                                borderRadius: '4px', overflowX: 'auto', color: '#888',
                                marginTop: '4px'
                            }}>
                                {JSON.stringify(event.data, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
