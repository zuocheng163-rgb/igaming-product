import React from 'react';

/**
 * AlertModal
 * Premium UI for Duty of Care interventions.
 */
const AlertModal = ({ alert, onClose }) => {
    if (!alert) return null;

    const isAffordability = alert.type === 'AFFORDABILITY_CHECK';
    const title = isAffordability ? 'Affordability Review' : 'Play Break Suggestion';
    const icon = isAffordability ? '💳' : '⏱️';

    return (
        <div className="rg-alert-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(5, 10, 20, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(20px)', animation: 'fadeIn 0.4s ease-out'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .rg-modal { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>

            <div className="rg-modal glass-panel" style={{
                width: '100%', maxWidth: '500px', padding: '48px', textAlign: 'center',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.1)',
                borderRadius: '24px'
            }}>
                <div style={{ fontSize: '5rem', marginBottom: '24px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>
                    {icon}
                </div>

                <h2 style={{
                    color: 'var(--accent-gold, #ffd700)',
                    fontSize: '2rem',
                    fontWeight: 800,
                    marginBottom: '16px',
                    letterSpacing: '-0.02em'
                }}>
                    {title}
                </h2>

                <p style={{
                    fontSize: '1.15rem',
                    marginBottom: '12px',
                    lineHeight: '1.6',
                    color: '#e2e8f0'
                }}>
                    {alert.message}
                </p>

                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '32px',
                    borderLeft: '4px solid var(--accent-gold, #ffd700)',
                    textAlign: 'left'
                }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Regulatory Context (Explainability):
                    </p>
                    <p style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 500 }}>
                        {alert.reason || 'Automated behavioral analysis.'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className="btn-primary"
                        style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 700, borderRadius: '12px', transition: 'all 0.3s ease' }}
                        onClick={onClose}
                    >
                        I UNDERSTAND, CONTINUE
                    </button>
                    {isAffordability && (
                        <button
                            className="btn-secondary"
                            style={{ width: '100%', padding: '14px', borderRadius: '12px' }}
                            onClick={() => window.open('https://openbanking.neostrike.example', '_blank')}
                        >
                            CONNECT BANK NOW
                        </button>
                    )}
                </div>

                <p style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Protecting our players is our top priority. Reference: UKGC Duty of Care 2024.
                </p>
            </div>
        </div>
    );
};

export default AlertModal;
