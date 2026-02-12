import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';

const DataTable = ({ columns, data, loading, pagination, onPageChange, onSearch, searchPlaceholder, onRowDoubleClick }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (onSearch) onSearch(term);
    };

    return (
        <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Table Toolbar */}
            <div className="table-toolbar" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {onSearch && (
                    <div className="table-search" style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder={searchPlaceholder || 'Search records...'}
                            value={searchTerm}
                            onChange={handleSearch}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '8px 12px 8px 36px',
                                color: 'white',
                                fontSize: '0.9rem',
                                width: '240px',
                                outline: 'none'
                            }}
                        />
                    </div>
                )}
                {/* Additional Actions can be injected here */}
            </div>

            {/* Table Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(20,22,28,0.95)', zIndex: 10 }}>
                        <tr>
                            {columns.map((col, i) => (
                                <th key={i} style={{
                                    padding: '16px 20px',
                                    textAlign: 'left',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500,
                                    fontSize: '0.8rem',
                                    textTransform: 'uppercase',
                                    cursor: col.sortable ? 'pointer' : 'default'
                                }}>
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '60px', textAlign: 'center' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
                                    <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading data...</p>
                                </td>
                            </tr>
                        ) : data?.length > 0 ? (
                            data.map((row, i) => (
                                <tr
                                    key={i}
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: '0.2s', cursor: onRowDoubleClick ? 'pointer' : 'default' }}
                                    className="table-row"
                                    onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                                >
                                    {columns.map((col, j) => (
                                        <td key={j} style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No records found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && (
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                }}>
                    <span>Page {pagination.page} of {pagination.totalPages}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => onPageChange(pagination.page - 1)}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                color: 'white',
                                cursor: 'pointer',
                                opacity: pagination.page === 1 ? 0.5 : 1
                            }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => onPageChange(pagination.page + 1)}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                color: 'white',
                                cursor: 'pointer',
                                opacity: pagination.page >= pagination.totalPages ? 0.5 : 1
                            }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
