import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

const GGRTrendChart = ({ data }) => {
    return (
        <div className="ggr-chart-wrapper glass-panel">
            <div className="chart-header">
                <h3>30-Day GGR Performance</h3>
                <div className="legend">
                    <span className="dot-indicator ggr"></span> GGR
                    <span className="dot-indicator ngr"></span> NGR
                </div>
            </div>

            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorGgr" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00ccff" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#00ccff" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorNgr" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffd700" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ffd700" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            stroke="rgba(255,255,255,0.4)"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.4)"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `€${v}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(10, 10, 18, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                backdropFilter: 'blur(10px)'
                            }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="ggr"
                            stroke="#00ccff"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorGgr)"
                        />
                        <Area
                            type="monotone"
                            dataKey="ngr"
                            stroke="#ffd700"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorNgr)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

        </div>
    );
};

export default GGRTrendChart;
