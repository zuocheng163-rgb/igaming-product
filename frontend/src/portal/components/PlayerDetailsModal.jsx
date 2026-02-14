import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, User, Mail, Phone, MapPin, Calendar, Shield } from 'lucide-react';

const PlayerDetailsModal = ({ userId, token, onClose }) => {
    const [player, setPlayer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (!userId || !token) return;

        fetch(`/api/operator/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setPlayer(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [userId, token]);

    const maskEmail = (email) => {
        if (!email) return 'N/A';
        const [name, domain] = email.split('@');
        return `${name.substring(0, 2)}***@${domain}`;
    };

    const maskPhone = (phone) => {
        if (!phone) return 'N/A';
        return `***${phone.slice(-4)}`;
    };

    const maskAddress = (address) => {
        if (!address) return 'N/A';
        return '*** *** ***';
    };

    if (!userId) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-prominent" onClick={onClose}>
                    <X size={18} />
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={24} />
                        Player Details
                    </h2>
                    <button onClick={onClose} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Loading player details...
                    </div>
                ) : !player ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4d' }}>
                        Failed to load player details
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PII Protection</div>
                                <div style={{ fontSize: '0.9rem' }}>{revealed ? 'Sensitive data visible' : 'Sensitive data masked'}</div>
                            </div>
                            <button
                                onClick={() => setRevealed(!revealed)}
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                                {revealed ? 'Hide' : 'Reveal'} PII
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            <DetailRow icon={<User size={16} />} label="User ID" value={player.user_id || 'N/A'} />
                            <DetailRow icon={<User size={16} />} label="Username" value={player.username || 'N/A'} />
                            <DetailRow icon={<User size={16} />} label="Full Name" value={`${player.first_name || ''} ${player.last_name || ''}`.trim() || 'N/A'} />
                            <DetailRow
                                icon={<Mail size={16} />}
                                label="Email"
                                value={revealed ? (player.email || 'N/A') : maskEmail(player.email)}
                                sensitive={!revealed}
                            />
                            <DetailRow
                                icon={<Phone size={16} />}
                                label="Mobile"
                                value={revealed ? (player.full_mobile_number || player.mobile || 'N/A') : maskPhone(player.full_mobile_number || player.mobile)}
                                sensitive={!revealed}
                            />
                            <DetailRow
                                icon={<MapPin size={16} />}
                                label="Address"
                                value={revealed ? (player.address || 'N/A') : maskAddress(player.address)}
                                sensitive={!revealed}
                            />
                            <DetailRow icon={<MapPin size={16} />} label="Country" value={player.country || 'N/A'} />
                            <DetailRow icon={<Calendar size={16} />} label="Registration Date" value={player.registration_date ? new Date(player.registration_date).toLocaleDateString() : 'N/A'} />
                            <DetailRow icon={<Shield size={16} />} label="Verified" value={player.verified_at ? 'Yes' : 'No'} />
                            <DetailRow icon={<Shield size={16} />} label="Status" value={player.is_blocked ? 'Blocked' : player.is_excluded ? 'Excluded' : 'Active'} />
                        </div>

                        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Account Summary</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Balance</div>
                                    <div style={{ fontSize: '1.2rem', color: '#00ff88' }}>€{(player.balance || 0).toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bonus Balance</div>
                                    <div style={{ fontSize: '1.2rem', color: '#ffd700' }}>€{(player.bonus_balance || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const DetailRow = ({ icon, label, value, sensitive }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
        <div style={{ color: 'var(--primary)' }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: '0.95rem', fontFamily: sensitive ? 'monospace' : 'inherit' }}>{value}</div>
        </div>
    </div>
);

export default PlayerDetailsModal;
