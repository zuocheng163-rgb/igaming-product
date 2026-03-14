import React, { useState, useEffect } from 'react';

const OfflineState = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(10,10,20,0.9)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000, color: 'white', textAlign: 'center', padding: '40px'
        }}>
            <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🌐</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary, #00ccff)' }}>CONNECTION LOST</h2>
            <p style={{ maxWidth: '400px', opacity: 0.7, lineHeight: 1.6, marginBottom: '32px' }}>
                We've lost your connection to the NeoStrike Arena. 
                Please check your internet settings to continue playing safely.
            </p>
            
            <div style={{ 
                background: 'rgba(255,255,255,0.05)', 
                padding: '16px 32px', 
                borderRadius: '12px',
                display: 'flex', gap: '20px', alignItems: 'center'
            }}>
                <div className="offline-spinner" style={spinnerStyle}></div>
                <span style={{ fontWeight: 700, letterSpacing: '2px' }}>RECONNECTING...</span>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spin { to { transform: rotate(360deg); } }
            `}} />
        </div>
    );
};

const spinnerStyle = {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--primary, #00ccff)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
};

export default OfflineState;
