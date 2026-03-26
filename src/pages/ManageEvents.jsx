import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import {
  Plus,
  Calendar,
  Pencil,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useEvents } from '../contexts/EventContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { PROVINCE_NAMES } from '../data/provinces'
import SearchInput from '../components/SearchInput'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import '../styles/pages/PageStyles.css'
import '../styles/pages/ConsolidatedReport.css'
import '../styles/components/EventModal.css'

const PAGE_SIZES = [10, 25, 50]

// SVG icons for event category cards
const TyphoonIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12a3 3 0 1 0 3 3"/>
    <path d="M12 2c1.5 2.5 2 5.5 0 10"/><path d="M12 2c-1.5 2.5-2 5.5 0 10"/>
  </svg>
)
const FloodIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const EarthquakeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const TsunamiIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const WeatherIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const OtherIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const EVENT_CATEGORIES = [
  { value: 'typhoon',    label: 'Typhoon',        Icon: TyphoonIcon },
  { value: 'flood',     label: 'Flood',           Icon: FloodIcon },
  { value: 'earthquake',label: 'Earthquake',      Icon: EarthquakeIcon },
  { value: 'tsunami',   label: 'Tsunami',         Icon: TsunamiIcon },
  { value: 'weather',   label: 'Weather Alert',   Icon: WeatherIcon },
  { value: 'calamity',  label: 'Other Incident',  Icon: OtherIcon },
]

const ALERT_LEVELS = {
  typhoon: [
    { value: 'Signal #1', label: 'Signal #1', desc: 'Winds 60–89 km/h — minimal threat; some damage to light structures' },
    { value: 'Signal #2', label: 'Signal #2', desc: 'Winds 60–120 km/h — moderate; classes & work may be suspended' },
    { value: 'Signal #3', label: 'Signal #3', desc: 'Winds 121–170 km/h — severe; major damage, evacuations likely' },
    { value: 'Signal #4', label: 'Signal #4', desc: 'Winds 171–220 km/h — very destructive; widespread evacuations' },
    { value: 'Signal #5', label: 'Signal #5', desc: 'Winds >220 km/h — catastrophic; supertyphoon level' },
  ],
  earthquake: [
    { value: 'Intensity I', label: 'Intensity I', desc: 'Scarcely perceptible; detected only by instruments' },
    { value: 'Intensity II', label: 'Intensity II', desc: 'Slightly felt by few people at rest' },
    { value: 'Intensity III', label: 'Intensity III', desc: 'Weak; many people feel it; hanging objects sway' },
    { value: 'Intensity IV', label: 'Intensity IV', desc: 'Moderately strong; felt by most; minor rattling' },
    { value: 'Intensity V', label: 'Intensity V', desc: 'Strong; some objects fall; minor cracks' },
    { value: 'Intensity VI', label: 'Intensity VI', desc: 'Very strong; difficult to stand; structural damage' },
    { value: 'Intensity VII', label: 'Intensity VII', desc: 'Destructive; heavy damage; cracks in walls' },
    { value: 'Intensity VIII', label: 'Intensity VIII', desc: 'Very destructive; severe structure damage' },
    { value: 'Intensity IX', label: 'Intensity IX', desc: 'Devastating; most structures collapsed' },
    { value: 'Intensity X', label: 'Intensity X', desc: 'Completely devastating; total destruction' },
  ],
  tsunami: [
    { value: 'Information', label: 'Information', desc: 'Monitoring; no wave expected' },
    { value: 'Advisory', label: 'Advisory', desc: 'Small waves possible; stay away from shoreline' },
    { value: 'Watch', label: 'Watch', desc: 'Destructive waves possible; prepare to evacuate' },
    { value: 'Warning', label: 'Warning', desc: 'Destructive waves expected; evacuate immediately' },
  ],
  flood: [
    { value: 'Alert Level 1', label: 'Level 1', desc: 'Low flooding; monitor situation' },
    { value: 'Alert Level 2', label: 'Level 2', desc: 'Moderate flooding; prepare for evacuation' },
    { value: 'Alert Level 3', label: 'Level 3', desc: 'Critical/severe flooding; evacuate immediately' },
  ],
  calamity: [
    { value: 'Monitoring', label: 'Monitoring', desc: 'Normal surveillance' },
    { value: 'Active', label: 'Active', desc: 'Event is currently unfolding' },
    { value: 'Resolved', label: 'Resolved', desc: 'Incident has been managed' },
  ],
  weather: [
    { value: 'Yellow Warning', label: 'Yellow', desc: 'Heavy rainfall; flooding possible' },
    { value: 'Orange Warning', label: 'Orange', desc: 'Intense rainfall; flooding is threatening' },
    { value: 'Red Warning', label: 'Red', desc: 'Torrential rainfall; severe flooding expected' },
  ]
}

export default function ManageEvents() {
  const { user } = useOutletContext()
  const { events, addEvent, updateEvent, deleteEvent, deployEvent, loading } = useEvents()

  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('startDate')
  const [sortAsc, setSortAsc] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    color: '#6366f1',
    startDate: '',
    endDate: '',
    eventType: 'typhoon',
    alertStatus: 'white',
    summary: '',
    affectedProvinces: [],
    alertLevel: '',
    // typhoon-specific
    typhoonCategory: '',
    // earthquake-specific
    magnitude: '',
    intensity: '',
    // tsunami-specific
    waveHeight: '',
    tsunamiAlert: '',
    // flood-specific
    floodLevel: '',
    rainfall: '',
  })

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
    setCurrentPage(1)
  }

  const filtered = useMemo(() => {
    return events.filter(e =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.eventType.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      const va = a[sortKey] || ''
      const vb = b[sortKey] || ''
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }, [events, searchTerm, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const blankForm = () => ({
    name: '', color: '#6366f1',
    startDate: new Date().toISOString().slice(0, 16),
    endDate: '', eventType: 'typhoon', alertStatus: 'white', alertLevel: '',
    summary: '', affectedProvinces: [],
    typhoonCategory: '',
    magnitude: '', intensity: '',
    waveHeight: '', tsunamiAlert: '',
    floodLevel: '', rainfall: '',
  })

  const openAddModal = () => {
    setEditingId(null)
    setForm(blankForm())
    setShowModal(true)
  }

  const openEditModal = (event) => {
    setEditingId(event.id)
    setForm({
      name: event.name,
      color: event.color,
      startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
      eventType: event.eventType,
      alertStatus: event.alertStatus,
      summary: event.summary || '',
      affectedProvinces: event.affectedProvinces || [],
      alertLevel: event.alertLevel || '',
      // categories
      typhoonCategory: event.typhoonCategory || '',
      magnitude: event.magnitude || '',
      intensity: event.intensity || '',
      waveHeight: event.waveHeight || '',
      tsunamiAlert: event.tsunamiAlert || '',
      floodLevel: event.floodLevel || '',
      rainfall: event.rainfall || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (shouldClose = true) => {
    if (!form.name.trim()) return null
    
    // Auto-generate summary if empty
    let finalSummary = form.summary
    if (!finalSummary) {
      if (form.eventType === 'typhoon') {
        finalSummary = `**TYPHOON ${form.name.toUpperCase()}**\n\n* **Category**: ${form.typhoonCategory || 'Monitoring'}\n* **Warning Signal**: ${form.alertLevel || 'Not Set'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      } else if (form.eventType === 'earthquake') {
        finalSummary = `**EARTHQUAKE: ${form.name}**\n\n* **Magnitude**: ${form.magnitude || '—'}\n* **Intensity**: Intensity ${form.intensity || '—'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      } else if (form.eventType === 'tsunami') {
        finalSummary = `**TSUNAMI: ${form.name}**\n\n* **Alert Level**: ${form.tsunamiAlert || 'Monitoring'}\n* **Wave Height**: ${form.waveHeight ? form.waveHeight + 'm' : '—'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      } else if (form.eventType === 'flood') {
        finalSummary = `**FLOODING: ${form.name}**\n\n* **Flood Level**: ${form.floodLevel || '—'}\n* **Rainfall**: ${form.rainfall || '—'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      } else if (form.eventType === 'weather') {
        finalSummary = `**WEATHER ALERT: ${form.name}**\n\n* **Alert**: ${form.alertLevel || 'Monitoring'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      } else {
        finalSummary = `**EVENT: ${form.name}**\n\n* **Type**: ${form.eventType.toUpperCase()}\n* **Level**: ${form.alertLevel || 'Active'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
      }
    }

    const payload = {
      ...form,
      summary: finalSummary
    }

    let result = null
    if (editingId) {
      await updateEvent(editingId, payload)
      result = editingId
    } else {
      const newEvent = await addEvent(payload)
      result = newEvent?.id
    }
    
    if (shouldClose) setShowModal(false)
    return result
  }

  const handleToggleProvince = (prov) => {
    setForm(prev => ({
      ...prev,
      affectedProvinces: prev.affectedProvinces.includes(prov)
        ? prev.affectedProvinces.filter(p => p !== prov)
        : [...prev.affectedProvinces, prov]
    }))
  }

  const confirmDelete = async () => {
    if (deletingId) await deleteEvent(deletingId)
    setShowDeleteConfirm(false)
    setDeletingId(null)
  }

  const SortBtn = ({ colKey, label }) => (
    <button className="consolidated-th-sort" onClick={() => handleSort(colKey)}>
      {label}
      {sortKey === colKey
        ? (sortAsc ? <ChevronUp size={13} className="consolidated-sort-icon" /> : <ChevronDown size={13} className="consolidated-sort-icon" />)
        : <ChevronDown size={13} className="consolidated-sort-icon inactive" />}
    </button>
  )

  const alertPillClass = (status) => {
    if (status === 'red') return 'alert-pill alert-red'
    if (status === 'orange') return 'alert-pill'
    if (status === 'yellow') return 'alert-pill'
    return 'alert-pill alert-white'
  }

  const LABEL_STYLE = { display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }
  const INPUT_STYLE = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: 'white' }
  const SELECT_STYLE = { ...INPUT_STYLE, cursor: 'pointer' }

  if (loading) return (
    <div className="consolidated-report-page">
      <LoadingSpinner label="Loading events…" />
    </div>
  )

  return (
    <div className="consolidated-report-page">
      <div className="consolidated-report-card">

        {/* Toolbar */}
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            <div>
              <h1 className="consolidated-report-title">Manage Events</h1>
              <p className="consolidated-report-subtitle">Create and oversee regional disaster events</p>
            </div>
          </div>
          <div className="consolidated-report-toolbar-controls">
            <div className="consolidated-report-showing-select">
              <span className="consolidated-report-showing-label">Showing</span>
              <div className="consolidated-report-dropdown-wrap">
                <select className="consolidated-report-filter-dropdown consolidated-report-showing-dropdown" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}>
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="consolidated-report-dropdown-chevron" />
              </div>
            </div>
             <div className="consolidated-report-search-box">
               <SearchInput placeholder="Search incidents..." value={searchTerm} onChange={val => { setSearchTerm(val); setCurrentPage(1) }} />
             </div>
            <button onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
              <Plus size={16} />New Event
            </button>
          </div>
        </div>

        {/* Section Label */}
        <div style={{ padding: '1rem 1.75rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.25)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events</span>
        </div>

        {/* Table */}
        <div className="consolidated-report-table-wrapper">
          <table className="consolidated-report-table">
            <thead>
              <tr>
                <th><SortBtn colKey="name" label="Event Name" /></th>
                <th><SortBtn colKey="startDate" label="Date of Event" /></th>
                <th>ALERT LVL</th>
                <th>Deployment</th>
                <th>Provinces</th>
                <th className="col-action">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(event => (
                <tr key={event.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: event.color, flexShrink: 0 }} />
                      <span className="event-name-cell">{event.name}</span>
                    </div>
                  </td>
                  <td className="event-date-cell">
                    {event.startDate ? new Date(event.startDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <span className={alertPillClass(event.alertStatus)}>
                      {(event.alertStatus || 'white').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {event.isDeployed
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 700 }}><CheckCircle2 size={12} />Deployed</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}><Info size={12} />Draft</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {event.affectedProvinces?.length > 0
                        ? event.affectedProvinces.map(p => <span key={p} style={{ display: 'inline-block', padding: '2px 8px', background: '#ede9fe', color: '#5b21b6', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{p}</span>)
                        : <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>None</span>}
                    </div>
                  </td>
                  <td className="col-action">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <button 
                        onClick={() => openEditModal(event)} 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '6px 12px', 
                          background: 'white', 
                          color: '#6366f1', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="View Details"
                      >
                        <Info size={14} /> View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan="6" className="consolidated-report-empty">{searchTerm ? `No events matching "${searchTerm}"` : 'No incidents with reports found.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="consolidated-report-pagination">
          <button className="consolidated-report-pagination-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1}>&lt; Previous</button>
          <div className="consolidated-report-pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} className={`consolidated-report-pagination-num ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>
                {String(page).padStart(2, '0')}
              </button>
            ))}
          </div>
          <button className="consolidated-report-pagination-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>Next &gt;</button>
        </div>
      </div>

      {/* ══════════════ ADD / EDIT EVENT MODAL ══════════════ */}
      {showModal && createPortal(
        <div className="event-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '660px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div className="modal-header">
              <div style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '12px', borderRadius: '12px' }}>
                <Calendar size={24} />
              </div>
              <div style={{ marginLeft: '12px', flex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  {editingId ? 'Edit Event' : 'Add Event'}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '2px 0 0' }}>
                  Define the details and timing for this event context.
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="modal-body" style={{ padding: '1.25rem 2rem', overflowY: 'auto', flex: 1 }}>

              {/* EVENT CATEGORY */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LABEL_STYLE}>Event Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {EVENT_CATEGORIES.map(({ value, label, Icon }) => {
                    const isSelected = form.eventType === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, eventType: value }))}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: '8px', padding: '16px 8px', minHeight: '88px',
                          borderRadius: '12px',
                          border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                          background: isSelected ? 'rgba(99,102,241,0.06)' : '#fafafa',
                          color: isSelected ? '#6366f1' : '#475569',
                          fontWeight: 600, fontSize: '0.8125rem',
                          cursor: 'pointer', transition: 'all 0.15s',
                          boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none'
                        }}
                      >
                        <span style={{ color: isSelected ? '#6366f1' : '#94a3b8' }}><Icon /></span>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* EVENT NAME */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LABEL_STYLE}>
                  {form.eventType === 'typhoon' ? 'Typhoon Name' :
                   form.eventType === 'flood' ? 'Flood Event Name' :
                   form.eventType === 'earthquake' ? 'Earthquake Name' :
                   form.eventType === 'tsunami' ? 'Tsunami Name' :
                   form.eventType === 'weather' ? 'Weather Alert Name' :
                   'Incident Name'}
                </label>
                <input
                  type="text"
                  placeholder={
                    form.eventType === 'typhoon' ? 'Select or type typhoon name.' :
                    form.eventType === 'weather' ? 'e.g. Northeast Monsoon' :
                    'Enter event name...'
                  }
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...INPUT_STYLE, background: '#fafafa', fontSize: '0.9375rem', padding: '12px 14px' }}
                />
              </div>

              {/* DISASTER CLASSIFICATION LEVEL */}
              {['typhoon', 'earthquake', 'tsunami', 'flood'].includes(form.eventType) && (
                <div style={{ marginBottom: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <AlertTriangle size={14} color="#f59e0b" />
                    <span style={LABEL_STYLE}>Disaster Classification Level</span>
                  </div>

                  {form.eventType === 'typhoon' && (
                    <div style={{ display: 'block' }}>
                      <label style={{ ...LABEL_STYLE, marginBottom: '12px' }}>Typhoon Category</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { value: 'Tropical Depression', label: 'Tropical Depression (TD) — ≤ 61 km/h' },
                          { value: 'Tropical Storm', label: 'Tropical Storm (TS) — 62–88 km/h' },
                          { value: 'Severe Tropical Storm', label: 'Severe Tropical Storm (STS) — 89–117 km/h' },
                          { value: 'Typhoon', label: 'Typhoon (TY) — 118–184 km/h' },
                          { value: 'Super Typhoon', label: 'Super Typhoon (STY) — ≥ 185 km/h' }
                        ].map(cat => {
                          const isSelected = form.typhoonCategory === cat.value
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, typhoonCategory: cat.value }))}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                                color: isSelected ? '#6366f1' : '#475569',
                                fontWeight: isSelected ? 700 : 600,
                                fontSize: '0.8125rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                textAlign: 'left',
                                boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none'
                              }}
                            >
                              {cat.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {form.eventType === 'earthquake' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={LABEL_STYLE}>Magnitude (Richter)</label>
                        <input type="number" step="0.1" min="1" max="10" placeholder="e.g. 6.5" value={form.magnitude || ''} onChange={e => setForm(f => ({ ...f, magnitude: e.target.value }))} style={INPUT_STYLE} />
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE, marginBottom: '12px' }}>PHIVOLCS Intensity Scale</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                          {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].map(i => {
                            const val = `Intensity ${i}`
                            const isSelected = form.intensity === i
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, intensity: i }))}
                                style={{
                                  padding: '8px',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                                  color: isSelected ? '#6366f1' : '#475569',
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {i}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {form.eventType === 'tsunami' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={LABEL_STYLE}>Wave Height (meters)</label>
                        <input type="number" step="0.1" min="0" placeholder="e.g. 3.5" value={form.waveHeight || ''} onChange={e => setForm(f => ({ ...f, waveHeight: e.target.value }))} style={INPUT_STYLE} />
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE, marginBottom: '12px' }}>Tsunami Alert</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {['Information', 'Advisory', 'Watch', 'Warning'].map(cat => {
                            const isSelected = form.tsunamiAlert === cat
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, tsunamiAlert: cat }))}
                                style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                                  color: isSelected ? '#6366f1' : '#475569',
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: '0.8125rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {cat}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {form.eventType === 'flood' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ ...LABEL_STYLE, marginBottom: '12px' }}>Flood Level</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[
                            { value: 'Low', label: 'Low' },
                            { value: 'Moderate', label: 'Moderate' },
                            { value: 'High', label: 'High' },
                            { value: 'Critical', label: 'Critical' }
                          ].map(cat => {
                            const isSelected = form.floodLevel === cat.value
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, floodLevel: cat.value }))}
                                style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                                  color: isSelected ? '#6366f1' : '#475569',
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: '0.8125rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label style={{ ...LABEL_STYLE, marginBottom: '12px' }}>Rainfall Intensity</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[
                            { value: 'Light', label: 'Light' },
                            { value: 'Moderate', label: 'Moderate' },
                            { value: 'Heavy', label: 'Heavy' },
                            { value: 'Intense', label: 'Intense' }
                          ].map(cat => {
                            const isSelected = form.rainfall === cat.value
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, rainfall: cat.value }))}
                                style={{
                                  padding: '10px',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                                  color: isSelected ? '#6366f1' : '#475569',
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: '0.8125rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ALERT LEVEL / WARNING SIGNAL */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LABEL_STYLE}>Alert Level / Warning Signal</label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(ALERT_LEVELS[form.eventType] || ALERT_LEVELS.calamity).map(opt => {
                    const isSelected = form.alertLevel === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, alertLevel: opt.value }))}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                          background: isSelected ? 'rgba(99,102,241,0.06)' : 'white',
                          color: isSelected ? '#6366f1' : '#475569',
                          fontWeight: isSelected ? 700 : 600,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textAlign: 'left',
                          boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{opt.label}</span>
                        {opt.desc && <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 500 }}>{opt.desc}</span>}
                      </button>
                    )
                  })}
                </div>

                {form.alertLevel && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                    Active selection: <strong style={{color: '#6366f1'}}>{form.alertLevel}</strong>. This will be shown on the dashboard meta bar.
                  </p>
                )}
              </div>

              {/* AFFECTED PROVINCES */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={LABEL_STYLE}>Affected Provinces</label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, affectedProvinces: f.affectedProvinces.length === PROVINCE_NAMES.length ? [] : [...PROVINCE_NAMES] }))} style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    {form.affectedProvinces.length === PROVINCE_NAMES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PROVINCE_NAMES.map(p => (
                    <button key={p} type="button" onClick={() => handleToggleProvince(p)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: form.affectedProvinces.includes(p) ? '#6366f1' : 'white', color: form.affectedProvinces.includes(p) ? 'white' : '#64748b', borderColor: form.affectedProvinces.includes(p) ? '#6366f1' : '#e2e8f0', transition: 'all 0.15s' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* THEME COLOR */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LABEL_STYLE}>Theme Color</label>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: '52px', height: '42px', padding: '2px', borderRadius: '8px', border: '1.5px solid #e2e8f0', cursor: 'pointer' }} />
              </div>

              {/* EVENT DURATION */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={LABEL_STYLE}>Event Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <ModernDateTimePicker label="Event Start" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  <ModernDateTimePicker label="Event End (Optional)" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

            </div>{/* end scrollable body */}

            {/* Footer */}
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {editingId && (
                  <button 
                    className="modal-btn-cancel" 
                    onClick={() => { setDeletingId(editingId); setShowDeleteConfirm(true) }}
                    style={{ color: '#ef4444', borderColor: '#fecaca', background: 'rgba(239, 68, 68, 0.05)' }}
                  >
                    <Trash2 size={16} style={{ marginRight: '6px' }} /> Delete Event
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="modal-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                
                {/* Save Changes Button (Always updates the DB draft) */}
                <button 
                  className="modal-btn-primary" 
                  onClick={handleSubmit} 
                  disabled={!form.name.trim()}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                >
                  {editingId ? 'Save Draft' : 'Create Draft'}
                </button>

                {/* Deploy Button (Updates DB AND saves snapshot to Dashboard) */}
                <button 
                  className="modal-btn-primary" 
                  onClick={async () => {
                    // First save the current form data without closing modal yet
                    const targetId = await handleSubmit(false);
                    // Then deploy it using the returned ID
                    if (targetId) await deployEvent(targetId);
                    setShowModal(false);
                  }} 
                  disabled={!form.name.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={16} />
                  {events.find(e => e.id === editingId)?.isDeployed ? 'Update & Re-deploy' : 'Save & Deploy'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && createPortal(
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content glass-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-confirm">
              <div className="modal-confirm-icon modal-confirm-icon--danger"><AlertTriangle size={28} /></div>
              <h2 className="modal-confirm-title">Delete Event?</h2>
              <p className="modal-confirm-text">This action cannot be undone. All associated data will be removed.</p>
              <div className="modal-confirm-footer">
                <button className="modal-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="modal-btn-danger" onClick={confirmDelete}>Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
