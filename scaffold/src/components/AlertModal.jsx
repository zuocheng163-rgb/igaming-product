import React, { useEffect, useCallback } from 'react';
import { useAlerts, useSession } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import theme from '../../theme.config';

export const AlertModal = () => {
    const { player } = useSession();
    const { alerts, dismiss, refresh } = useAlerts(player?.user_id);
    const [localAlert, setLocalAlert] = React.useState(null);

    // LOGGING (Debug)
    useEffect(() => {
        if (localAlert) console.log('[AlertModal] Local alert active:', localAlert.title);
    }, [localAlert]);

    // Handle Simulated Alerts (Global listener)
    useEffect(() => {
        const handleSimulatedAlert = (e) => {
            const { title, message, severity } = e.detail;
            logSDKEvent('INTERVENTION', `UI Processing Simulated Alert: ${title}`);
            console.log('[AlertModal] Received simulated event:', title);
            setLocalAlert({ ...e.detail, id: 'sim-' + Date.now() });
        };
        window.addEventListener('neostrike-simulate-alert', handleSimulatedAlert);
        return () => window.removeEventListener('neostrike-simulate-alert', handleSimulatedAlert);
    }, []);

    // Monitoring of Real Interventions
    useEffect(() => {
        if (!player) return;
        const interval = setInterval(() => {
            refresh();
        }, 8000);
        return () => clearInterval(interval);
    }, [player, refresh]);

    // Log new alerts when they arrive (Real)
    useEffect(() => {
        if (alerts && alerts.length > 0) {
            alerts.forEach(alert => {
                logSDKEvent('INTERVENTION', `Real alert received: ${alert.title}`, { severity: alert.severity });
            });
        }
    }, [alerts]);

    const activeAlerts = localAlert ? [localAlert, ...(alerts || [])] : (alerts || []);
    if (activeAlerts.length === 0) return null;

    const currentAlert = activeAlerts[0];

    const handleDismiss = async () => {
        logSDKEvent('UI', `Dismissing alert: ${currentAlert.title}`);

        // Critical alerts often imply session termination in RG simulations
        if (currentAlert.severity === 'critical') {
            logSDKEvent('SDK', 'Critical alert dismissal triggering session logout');
            logout();
        }

        if (currentAlert.id?.toString().startsWith('sim-')) {
            setLocalAlert(null);
        } else {
            await dismiss(currentAlert.id);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.9)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 20000, padding: '20px', boxSizing: 'border-box',
            backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: '#16213e', padding: '40px', borderRadius: '20px',
                maxWidth: '500px', width: '100%', textAlign: 'center',
                color: '#fff', border: `2px solid ${currentAlert.severity === 'critical' ? '#ff4444' : '#00d4ff'}`,
                boxShadow: `0 0 50px ${currentAlert.severity === 'critical' ? '#ff444433' : '#00d4ff33'}`
            }}>
                <div style={{ fontSize: '50px', marginBottom: '20px' }}>
                    {currentAlert.severity === 'critical' ? '🛑' : 'ℹ️'}
                </div>
                <h2 style={{
                    color: currentAlert.severity === 'critical' ? '#ff4444' : '#00d4ff',
                    margin: 0, fontSize: '24px', letterSpacing: '1px'
                }}>
                    {currentAlert.title?.toUpperCase() || 'PLAYER NOTIFICATION'}
                </h2>
                <p style={{ margin: '24px 0', lineHeight: '1.6', color: '#ccc', fontSize: '16px' }}>
                    {currentAlert.message}
                </p>
                <button
                    onClick={handleDismiss}
                    style={{
                        background: currentAlert.severity === 'critical' ? '#ff4444' : '#00d4ff',
                        color: '#000', border: 'none', padding: '14px 40px',
                        borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer',
                        fontSize: '15px', transition: 'transform 0.2s',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                    {currentAlert.buttonText || 'ACKNOWLEDGE'}
                </button>
            </div>
        </div>
    );
};

