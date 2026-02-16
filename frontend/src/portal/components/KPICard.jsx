import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const KPICard = ({ label, value, trend, sparkline, icon: Icon, color, delay, onClick }) => {
    const isPositive = trend >= 0;
    const isSignificant = Math.abs(trend) >= 10;

    // Convert sparkline array to Recharts format
    const chartData = sparkline?.map((v, i) => ({ value: v, id: i })) || [];

    return (
        <div
            className={`kpi-card glass-panel floating ${isSignificant ? 'significant' : ''}`}
            style={{ '--delay': delay, cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick}
        >
            <div className="kpi-top">
                <div className="kpi-icon" style={{ backgroundColor: `${color}15`, color: color }}>
                    <Icon size={20} />
                </div>
                <div className={`trend-badge ${isPositive ? 'up' : 'down'}`}>
                    {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span>{Math.abs(trend)}%</span>
                </div>
            </div>

            <div className="kpi-info">
                <label>{label}</label>
                <div className="value">{value}</div>
                <div className="context">vs Yesterday</div>
            </div>

            <div className="kpi-sparkline">
                <ResponsiveContainer width="100%" height={40}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#grad-${label})`}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default KPICard;
