import React from 'react';
import LogEntry from './LogEntry';

function ActivitySidebar({ inboundLogs, outboundLogs }) {
    const renderSection = (title, logs, type) => (
        <section className="log-section">
            <h3 className="section-title">{title}</h3>
            <div className="log-list">
                {logs.length > 0 ? (
                    logs.map(log => (
                        <LogEntry key={log.id} log={log} type={type} />
                    ))
                ) : (
                    <div className="empty-logs">No activity recorded</div>
                )}
            </div>
        </section>
    );

    return (
        <aside className="activity-sidebar">
            {renderSection("📥 Inbound Activity", inboundLogs, "inbound")}
            {renderSection("📤 Outbound Activity", outboundLogs, "outbound")}
        </aside>
    );
}

export default ActivitySidebar;
