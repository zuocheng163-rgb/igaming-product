import React, { useState, useEffect } from 'react';

const InstallPrompt = ({ appName = 'NeoStrike', tagline = 'Play your favorite games in full-screen' }) => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            // Wait for 2nd session logic (simulated with setTimeout for demo)
            const sessions = parseInt(localStorage.getItem('ns_sessions') || '0');
            localStorage.setItem('ns_sessions', (sessions + 1).toString());
            
            const dismissed = localStorage.getItem('ns_install_dismissed');
            if (sessions >= 1 && !dismissed) {
                setShow(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShow(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('ns_install_dismissed', Date.now().toString());
    };

    if (!show) return null;

    return (
        <div className="sdk-install-prompt" style={{
            position: 'fixed', bottom: '24px', left: '24px', right: '24px',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid var(--primary, #00ccff)',
            borderRadius: '16px', padding: '20px', zIndex: 2000,
            display: 'flex', alignItems: 'center', gap: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            animation: 'slideUp 0.4s ease'
        }}>
            <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'var(--primary, #00ccff)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.2rem'
            }}>NS</div>
            
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>Install {appName}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{tagline}</div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleDismiss} style={{
                    background: 'transparent', border: 'none', color: 'white',
                    fontWeight: 700, cursor: 'pointer', opacity: 0.5
                }}>Maybe later</button>
                <button onClick={handleInstall} style={{
                    background: 'var(--primary, #00ccff)', color: '#000',
                    border: 'none', padding: '10px 20px', borderRadius: '10px',
                    fontWeight: 800, cursor: 'pointer'
                }}>Install</button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </div>
    );
};

export default InstallPrompt;
