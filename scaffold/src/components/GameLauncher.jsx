import React, { useState } from 'react';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import theme from '../../theme.config';

const MockGame = ({ game, onClose }) => {
    const [balance, setBalance] = useState(1000);
    const [lastWin, setLastWin] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);

    const handleSpin = () => {
        if (balance < 10) return;
        setIsSpinning(true);
        setLastWin(0);

        logSDKEvent('WALLET', `Simulation: Bet placed -10.00 EUR`, { gameId: game.id });
        setBalance(prev => prev - 10);

        setTimeout(() => {
            const win = Math.random() > 0.7 ? Math.floor(Math.random() * 50) + 10 : 0;
            if (win > 0) {
                setLastWin(win);
                setBalance(prev => prev + win);
                logSDKEvent('WALLET', `Simulation: Win credited +${win.toFixed(2)} EUR`);
            }
            setIsSpinning(false);
            logSDKEvent('SDK', 'Spin cycle complete');
        }, 800);
    };

    const triggerAlert = () => {
        logSDKEvent('INTERVENTION', 'Simulating Responsible Gaming Alert (Time Limit)');
        // In a real scenario, the backend would push this
        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
            detail: {
                title: 'Play Break Reminder',
                message: 'You have been playing for 60 minutes. Would you like to take a short break?',
                severity: 'info'
            }
        }));
    };

    return (
        <div style={{
            flex: 1, background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', position: 'relative'
        }}>
            <div style={{
                padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', width: '400px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>NEOSTRIKE SIMULATION ENGINE</div>
                <h2 style={{ fontSize: '32px', margin: '0 0 10px 0' }}>{game.name}</h2>
                <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '30px 0', color: theme.colors.primary }}>
                    {balance.toFixed(2)} <span style={{ fontSize: '18px' }}>EUR</span>
                </div>

                {lastWin > 0 && (
                    <div style={{
                        color: '#00ff88', fontWeight: 'bold', fontSize: '24px',
                        marginBottom: '20px', animation: 'bounce 0.5s infinite'
                    }}>
                        BIG WIN: +{lastWin.toFixed(2)}!
                    </div>
                )}

                <button
                    onClick={handleSpin}
                    disabled={isSpinning || balance < 10}
                    style={{
                        padding: '20px 60px', borderRadius: '40px', background: theme.colors.primary,
                        color: '#fff', border: 'none', fontSize: '24px', fontWeight: 'bold',
                        cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                >
                    {isSpinning ? 'SPINNING...' : 'SPIN (10 EUR)'}
                </button>

                <div style={{ marginTop: '40px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={triggerAlert}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
                            color: '#ccc', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '12px'
                        }}
                    >
                        Simulate RG Alert
                    </button>
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '20px', color: '#555', fontSize: '11px' }}>
                This is a simulated game environment for SDK feature demonstration only.
            </div>
        </div>
    );
};

export const GameLauncher = ({ game, launchUrl, onClose }) => {
    if (!game) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column'
        }}>
            <div style={{
                padding: '12px 24px', background: '#1a1a2e', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                        padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                    }}>← BACK TO LOBBY</button>
                    <div>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>{game.name}</span>
                        <span style={{ color: '#888', fontSize: '12px', marginLeft: '12px' }}>{game.provider}</span>
                    </div>
                </div>
                <div style={{
                    color: launchUrl ? '#00ff88' : '#ffaa00',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px',
                    padding: '4px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '20px'
                }}>
                    {launchUrl ? 'LIVE SESSION ACTIVE' : 'SIMULATION MODE'}
                </div>
            </div>

            {launchUrl ? (
                <div style={{ flex: 1, background: '#000' }}>
                    <iframe src={launchUrl} title={game.name} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                </div>
            ) : (
                <MockGame game={game} onClose={onClose} />
            )}
        </div>
    );
};

