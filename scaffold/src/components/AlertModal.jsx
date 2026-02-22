import React from 'react';
import { useAlerts, useSession } from '@neostrike/sdk';
import theme from '../../theme.config';

export const AlertModal = () => {
    const { player } = useSession();
    const { alerts, dismiss } = useAlerts(player?.user_id);

    if (!alerts || alerts.length === 0) return null;

    const currentAlert = alerts[0];

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                background: theme.colors.surface,
                padding: '30px',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'center',
                color: theme.colors.text,
                border: `2px solid ${currentAlert.severity === 'critical' ? '#ff4444' : theme.colors.primary}`
            }}>
                <h2 style={{ color: currentAlert.severity === 'critical' ? '#ff4444' : theme.colors.primary }}>
                    {currentAlert.title || 'Important Notice'}
                </h2>
                <p style={{ margin: '20px 0', lineHeight: '1.5', opacity: 0.9 }}>
                    {currentAlert.message}
                </p>
                <button
                    onClick={() => dismiss(currentAlert.id)}
                    style={{
                        background: theme.colors.primary,
                        color: '#fff',
                        border: 'none',
                        padding: '12px 30px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {currentAlert.buttonText || 'I Understand'}
                </button>
            </div>
        </div>
    );
};
