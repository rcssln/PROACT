import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ClockCounterClockwise, CaretDown, CaretUp, Upload } from '@phosphor-icons/react'
import SearchInput from '../components/SearchInput'
import LoadingSpinner from '../components/LoadingSpinner'
import { supabase } from '../lib/supabase'
import '../styles/pages/PageStyles.css'
import '../styles/pages/EventLogs.css'
import Button from '../components/Button'

const PAGE_SIZES = [10, 25, 50, 100]

export default function EventLogs() {
    const { user } = useOutletContext() ?? {}
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Pagination & Search & Sort State
    const [searchTerm, setSearchTerm] = useState('')
    const [pageSize, setPageSize] = useState(25)
    const [currentPage, setCurrentPage] = useState(1)
    const [sortKey, setSortKey] = useState('created_at')
    const [sortAsc, setSortAsc] = useState(false)

    useEffect(() => {
        const fetchEventLogs = async () => {
            if (!supabase || !user) return
            setLoading(true)
            setError(null)
            try {
                // Fetch up to 1000 logs for decent pagination
                const { data: logData, error: logError } = await supabase
                    .from('activity_logs')
                    .select(`
                        *,
                        users:user_id (
                            id,
                            first_name,
                            last_name,
                            email,
                            account_type,
                            province,
                            city
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .limit(1000)

                if (logError) throw logError

                let filteredLogs = []
                if (logData) {
                    const accountType = user.account_type || user.role

                    if (accountType === 'Super Admin' || accountType === 'Regional') {
                        filteredLogs = logData
                    } else if (accountType === 'Provincial') {
                        filteredLogs = logData.filter(log => {
                            const creatorType = log.users?.account_type
                            return creatorType === 'Provincial' || creatorType === 'LGU'
                        })
                    } else if (accountType === 'LGU') {
                        filteredLogs = logData.filter(log => {
                            const creatorType = log.users?.account_type
                            return creatorType === 'LGU'
                        })
                    } else {
                        filteredLogs = logData.filter(log => log.user_id === user.id)
                    }
                }

                setLogs(filteredLogs)

            } catch (err) {
                console.error('Failed to load event logs:', err)
                setError('Failed to fetch logs. Please try again.')
            } finally {
                setLoading(false)
            }
        }

        fetchEventLogs()
    }, [user])

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc)
        } else {
            setSortKey(key)
            setSortAsc(true)
        }
    }

    const sortedLogs = useMemo(() => {
        let result = [...logs]

        if (searchTerm) {
            const lowerQuery = searchTerm.toLowerCase()
            result = result.filter(log => {
                const authorName = log.users ? `${log.users.first_name || ''} ${log.users.last_name || ''}`.toLowerCase() : ''
                const action = (log.action || '').toLowerCase()
                const details = (log.details || '').toLowerCase()
                return authorName.includes(lowerQuery) || action.includes(lowerQuery) || details.includes(lowerQuery)
            })
        }

        result.sort((a, b) => {
            let valA, valB

            if (sortKey === 'action') {
                valA = a.action || ''
                valB = b.action || ''
            } else if (sortKey === 'author') {
                valA = a.users ? `${a.users.first_name || ''} ${a.users.last_name || ''}` : ''
                valB = b.users ? `${b.users.first_name || ''} ${b.users.last_name || ''}` : ''
            } else if (sortKey === 'account_type') {
                valA = a.users?.account_type || ''
                valB = b.users?.account_type || ''
            } else if (sortKey === 'created_at') {
                valA = new Date(a.created_at).getTime()
                valB = new Date(b.created_at).getTime()
            }

            if (valA < valB) return sortAsc ? -1 : 1
            if (valA > valB) return sortAsc ? 1 : -1
            return 0
        })

        return result
    }, [logs, searchTerm, sortKey, sortAsc])

    const totalPages = Math.ceil(sortedLogs.length / pageSize) || 1
    const paginatedLogs = sortedLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const exportCSV = () => {
        const headers = ['Action', 'Author', 'Account Type', 'Details', 'Date']
        const rows = sortedLogs.map((log) => [
            log.action || '',
            log.users ? `${log.users.first_name || ''} ${log.users.last_name || ''}`.trim() : 'Unknown',
            log.users?.account_type || 'Unknown',
            log.details || '',
            new Date(log.created_at).toLocaleString()
        ])
        const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `event-logs-${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
    }

    const SortIcon = ({ columnKey }) => {
        if (sortKey !== columnKey) return <CaretDown size={14} className="logs-sort-icon inactive" />
        return sortAsc ? <CaretUp size={14} className="logs-sort-icon" /> : <CaretDown size={14} className="logs-sort-icon" />
    }

    const firstLetter = (log) => {
        if (log.users && log.users.first_name) return log.users.first_name.charAt(0).toUpperCase()
        if (log.users && log.users.email) return log.users.email.charAt(0).toUpperCase()
        return '?'
    }

    const displayName = (log) => {
        if (log.users && log.users.first_name && log.users.last_name) {
            return `${log.users.first_name} ${log.users.last_name}`
        }
        return log.users?.email || 'Unknown User'
    }

    return (
        <div className="page consolidated-report-page">
            <div className="consolidated-report-card">
                <div className="consolidated-report-toolbar">
                    <h1 className="consolidated-report-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                        <ClockCounterClockwise size={24} color="#6366f1" />
                        Event Logs
                    </h1>
                    <div className="consolidated-report-toolbar-controls">
                        <SearchInput
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(val) => {
                                setSearchTerm(val)
                                setCurrentPage(1)
                            }}
                            suggestions={[]}
                            className="consolidated-report-search-box"
                        />
                        <Button variant="outline" onClick={exportCSV} leftIcon={<Upload size={16} />}>
                            Export CSV
                        </Button>
                    </div>
                </div>

                <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>
                    Displaying logs up to <strong style={{ color: '#0f172a' }}>{user?.account_type || user?.role}</strong> clearance level.
                </div>

                {error && (
                    <div className="logs-error" role="alert">
                        {error}
                    </div>
                )}

                {loading ? (
                    <LoadingSpinner label="Loading event logs..." />
                ) : logs.length > 0 ? (
                    <>
                        <div className="consolidated-report-table-wrapper">
                            <table className="consolidated-report-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '20%' }}>
                                            <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('action')}>
                                                Action
                                                <SortIcon columnKey="action" />
                                            </Button>
                                        </th>
                                        <th style={{ width: '20%' }}>
                                            <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('author')}>
                                                Author
                                                <SortIcon columnKey="author" />
                                            </Button>
                                        </th>
                                        <th style={{ width: '15%' }}>
                                            <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('account_type')}>
                                                Clearance
                                                <SortIcon columnKey="account_type" />
                                            </Button>
                                        </th>
                                        <th style={{ width: '30%' }}>Details</th>
                                        <th style={{ width: '15%' }}>
                                            <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('created_at')}>
                                                Date
                                                <SortIcon columnKey="created_at" />
                                            </Button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLogs.map((log) => {
                                        const isMe = log.user_id === user?.id
                                        const authorType = log.users?.account_type || 'Unknown'

                                        return (
                                            <tr key={log.id}>
                                                <td style={{ fontWeight: 500, color: '#0f172a' }}>{log.action}</td>
                                                <td>
                                                    <div className="logs-cell-name">
                                                        <div className="logs-avatar">{firstLetter(log)}</div>
                                                        <span style={{ fontWeight: isMe ? 600 : 400 }}>{isMe ? 'You' : displayName(log)}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`logs-badge logs-badge-${authorType.toLowerCase().replace(' ', '-')}`}>
                                                        {authorType}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#64748b' }}>
                                                    {log.details || '-'}
                                                </td>
                                                <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                    {new Date(log.created_at).toLocaleString(undefined, {
                                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                                    })}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="consolidated-report-pagination">
                            <Button
                                variant="subtle"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                &lt; Previous
                            </Button>
                            <div className="consolidated-report-pagination-numbers">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                                    .map((p, idx, arr) => (
                                        <span key={p}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="consolidated-report-pagination-ellipsis">...</span>}
                                            <Button
                                                variant={currentPage === p ? 'solid' : 'ghost'}
                                                size="sm"
                                                style={{ minWidth: '36px', height: '36px', padding: 0 }}
                                                onClick={() => setCurrentPage(p)}
                                            >
                                                {String(p).padStart(2, '0')}
                                            </Button>
                                        </span>
                                    ))}
                            </div>
                            <Button
                                variant="subtle"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next &gt;
                            </Button>
                        </div>
                    </>
                ) : !error ? (
                    <div className="logs-empty">
                        No logs have been recorded yet for your clearance level.
                    </div>
                ) : null}
            </div>
        </div>
    )
}
