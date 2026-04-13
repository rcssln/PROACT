import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import {
  Plus, Calendar, Pencil, Trash, PaperPlaneRight, Warning, CheckCircle, X, Info, CaretDown, CaretUp, ArrowsClockwise, Globe, ArrowRight, Hurricane, Waves, Waveform, CloudWarning, Drop, WarningCircle } from '@phosphor-icons/react'
import { useEvents } from '../contexts/EventContext'
import { fetchGDACSEvents, fetchGDACSEventDetails, gdacsTypeLabel } from '../services/gdacsService'
import LoadingSpinner from '../components/LoadingSpinner'
import { PROVINCE_NAMES } from '../data/provinces'
import SearchInput from '../components/SearchInput'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import '../styles/pages/PageStyles.css'
import '../styles/pages/ConsolidatedReport.css'
import '../styles/components/EventModal.css'

const PAGE_SIZES = [10, 25, 50]

// Phosphor icons for event category cards
const TyphoonIcon = () => <Hurricane size={32} weight="duotone" />
const FloodIcon = () => <Drop size={32} weight="duotone" />
const EarthquakeIcon = () => <Waveform size={32} weight="duotone" />
const TsunamiIcon = () => <Waves size={32} weight="duotone" />
const WeatherIcon = () => <CloudWarning size={32} weight="duotone" />
const OtherIcon = () => <WarningCircle size={32} weight="duotone" />

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
    { value: 'Tropical Depression', label: 'Tropical Depression (TD)', desc: 'Winds ≤ 61 km/h' },
    { value: 'Tropical Storm', label: 'Tropical Storm (TS)', desc: 'Winds 62–88 km/h' },
    { value: 'Severe Tropical Storm', label: 'Severe Tropical Storm (STS)', desc: 'Winds 89–117 km/h' },
    { value: 'Typhoon', label: 'Typhoon (TY)', desc: 'Winds 118–184 km/h' },
    { value: 'Super Typhoon', label: 'Super Typhoon (STY)', desc: 'Winds ≥ 185 km/h' },
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
    gdacsId: '',
    windspeed: '',
    depth: '',
    affectedBarangays: '',
  })

  // GDACS Integration State
  const [gdacsEvents, setGdacsEvents] = useState([])
  const [fetchingGdacs, setFetchingGdacs] = useState(false)
  const [showGdacsBrowser, setShowGdacsBrowser] = useState(false)
  const [gdacsError, setGdacsError] = useState(null)
  const [gdacsDetails, setGdacsDetails] = useState(null)

  const handleFetchGdacs = async () => {
    setFetchingGdacs(true)
    setGdacsError(null)
    try {
      const data = await fetchGDACSEvents()
      setGdacsEvents(data)
      setShowGdacsBrowser(true)
    } catch (err) {
      setGdacsError('Failed to fetch data from GDACS. Please try again.')
      console.error(err)
    } finally {
      setFetchingGdacs(false)
    }
  }

  const handleSelectGdacsEvent = async (gEvent) => {
    setFetchingGdacs(true)
    setGdacsError(null)
    
    try {
      // 1. Fetch Granular Details from GDACS
      const details = await fetchGDACSEventDetails(gEvent.gdacsType, gEvent.gdacsId)
      setGdacsDetails(details)

      const suggestedName = gEvent.gdacsName || ''
      const statusColorMap = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', white: '#64748b' }
      const themeColor = statusColorMap[gEvent.alertStatus] || '#6366f1'

      // 2. Automate Province Selection
      const apiProvinces = details?.impact?.provinces || []

      setForm(f => ({
        ...f,
        name: f.name || suggestedName, 
        color: themeColor,
        eventType: gEvent.eventType,
        alertStatus: gEvent.alertStatus,
        alertLevel: gEvent.alertLevel,
        startDate: gEvent.startDate,
        endDate: gEvent.endDate,
        summary: gEvent.description,
        affectedProvinces: Array.from(new Set([...f.affectedProvinces, ...apiProvinces])), // Merge existing with API detected
        gdacsId: gEvent.gdacsId, // Mark as GDACS event to trigger UI visibility logic
        // Type specific
        typhoonCategory: gEvent.typhoonCategory || '',
        magnitude: gEvent.magnitude || '',
        intensity: gEvent.intensity || '',
        waveHeight: gEvent.waveHeight || '',
        tsunamiAlert: gEvent.tsunamiAlert || '',
        floodLevel: gEvent.floodLevel || '',
        windspeed: gEvent.windspeed || '',
        depth: gEvent.depth || '',
        affectedBarangays: (details?.impact?.localCommunities || []).join(', '),
      }))
      
      setShowGdacsBrowser(false)
    } catch (err) {
      setGdacsError('Error processing GDACS event details.')
      console.error(err)
    } finally {
      setFetchingGdacs(false)
    }
  }

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
    gdacsId: '', windspeed: '', depth: '', affectedBarangays: '',
  })

  const openAddModal = () => {
    setEditingId(null)
    setGdacsDetails(null)
    setForm(blankForm())
    setShowModal(true)
  }

  const openEditModal = (event) => {
    setEditingId(event.id)
    setGdacsDetails(null) // Edit doesn't show the GDACS preview for now as it's not stored in the DB
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
      gdacsId: event.gdacsId || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (shouldClose = true) => {
    if (!form.name.trim()) return null
    
    // Auto-generate summary if empty
    let finalSummary = form.summary
    if (!finalSummary) {
      if (form.eventType === 'typhoon') {
        finalSummary = `**TYPHOON ${form.name.toUpperCase()}**\n\n* **Category**: ${form.typhoonCategory || 'Monitoring'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
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

    // If typhoon, sync alertLevel with category to reflect on dashboard meta bar
    if (form.eventType === 'typhoon') {
      payload.alertLevel = form.typhoonCategory || 'Monitoring'
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
        ? (sortAsc ? <CaretUp size={13} className="consolidated-sort-icon" /> : <CaretDown size={13} className="consolidated-sort-icon" />)
        : <CaretDown size={13} className="consolidated-sort-icon inactive" />}
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
                <CaretDown size={14} className="consolidated-report-dropdown-chevron" />
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
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 700 }}><CheckCircle size={12} />Deployed</span>
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

              {/* GDACS IMPORT BUTTON */}
              {!editingId && (
                <button
                  type="button"
                  onClick={handleFetchGdacs}
                  disabled={fetchingGdacs}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: fetchingGdacs ? '#f1f5f9' : 'rgba(99,102,241,0.1)',
                    color: '#6366f1',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginRight: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  {fetchingGdacs ? <ArrowsClockwise size={14} className="animate-spin" weight="bold" /> : <Globe size={14} />}
                  {fetchingGdacs ? 'Fetching GDACS...' : 'Import from GDACS'}
                </button>
              )}

              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="modal-body" style={{ padding: '1.25rem 2rem', overflowY: 'auto', flex: 1 }}>

              {/* GDACS BROWSER PANEL */}
              {showGdacsBrowser && (
                <div style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={16} color="#6366f1" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>Recent GDACS Events (Philippines Region)</span>
                    </div>
                    <button onClick={() => setShowGdacsBrowser(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '8px' }}>
                    {gdacsEvents.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No recent events found in the PH region.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {gdacsEvents.map(g => (
                          <div 
                            key={g.gdacsId} 
                            onClick={() => handleSelectGdacsEvent(g)}
                            style={{ 
                              padding: '12px', 
                              borderRadius: '10px', 
                              background: 'white', 
                              border: '1px solid #e2e8f0', 
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            className="gdacs-item-hover"
                          >
                            <div style={{ 
                              width: '36px', height: '36px', borderRadius: '8px', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: g.alertStatus === 'red' ? '#fee2e2' : g.alertStatus === 'orange' ? '#ffedd5' : '#fef9c3',
                              color: g.alertStatus === 'red' ? '#ef4444' : g.alertStatus === 'orange' ? '#f97316' : '#eab308'
                            }}>
                              <Warning size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{g.gdacsName}</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>{new Date(g.startDate).toLocaleDateString()}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                {gdacsTypeLabel(g.gdacsType)} • {g.alertLevel}
                              </div>
                            </div>
                            <ArrowRight size={14} color="#94a3b8" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gdacsError && (
                <div style={{ marginBottom: '1.25rem', padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Warning size={14} /> {gdacsError}
                </div>
              )}

              {/* ══════════════ NEW ENHANCED GDACS PREVIEW ══════════════ */}
              {form.gdacsId && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ padding: '16px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.05) 100%)', border: '1.5px solid rgba(99,102,241,0.2)' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Globe size={18} />
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source: GDACS Global Alert</span>
                          <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: 600 }}>Real-time automated sync active</span>
                        </div>
                      </div>
                      <div style={{ padding: '4px 10px', borderRadius: '20px', background: form.alertStatus === 'red' ? '#fee2e2' : '#fef9c3', color: form.alertStatus === 'red' ? '#ef4444' : '#854d0e', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        {form.alertStatus} Alert
                      </div>
                    </div>

                    {/* Technical Specs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                      {/* TYPE-SPECIFIC METRICS */}
                      {form.eventType === 'typhoon' && (
                        <>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>WIND SPEED</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{form.windspeed ? `${form.windspeed} km/h` : 'N/A'}</span>
                          </div>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>COMMUNITIES</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#6366f1' }}>{gdacsDetails?.impact?.localCommunities?.length || 0} Found</span>
                          </div>
                        </>
                      )}

                      {form.eventType === 'earthquake' && (
                        <>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>MAGNITUDE</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{form.magnitude || 'N/A'}</span>
                          </div>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>DEPTH</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{form.depth ? `${form.depth} km` : 'N/A'}</span>
                          </div>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>COMMUNITIES</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#6366f1' }}>{gdacsDetails?.impact?.localCommunities?.length || 0} Found</span>
                          </div>
                        </>
                      )}

                      {form.eventType === 'flood' && (
                        <>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>FLOOD LEVEL</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{form.floodLevel || 'N/A'}</span>
                          </div>
                          <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>COMMUNITIES</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#6366f1' }}>{gdacsDetails?.impact?.localCommunities?.length || 0} Found</span>
                          </div>
                        </>
                      )}

                      <div style={{ padding: '12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8' }}>ALERT SCORE</span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{gdacsDetails?.impact?.alertScore || (gdacsEvents.find(e => e.gdacsId === form.gdacsId)?.episodeAlertScore) || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Geograhic Impact Sub-panel */}
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px', border: '1px dashed rgba(99,102,241,0.3)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                         <Globe size={13} color="#6366f1" />
                         <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Detected Philippine LGUs</span>
                       </div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                         {(gdacsDetails?.impact?.lgus || []).length > 0 ? (
                           gdacsDetails.impact.lgus.map(l => (
                             <span key={l} style={{ padding: '3px 8px', background: 'white', border: '1px solid #e2e8f0', color: '#6366f1', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700 }}>{l}</span>
                           ))
                         ) : (
                           <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>No specific LGUs detected in bulletin text.</span>
                         )}
                       </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={14} color="#64748b" />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Manual overrides for classification levels are disabled for data integrity.</span>
                    </div>

                  </div>
                </div>
              )}

              {/* EVENT CATEGORY (Hidden for GDACS events) */}
              {!form.gdacsId && (
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
              )}

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

              {/* DISASTER CLASSIFICATION LEVEL (Hidden for GDACS events) */}
              {['typhoon', 'earthquake', 'tsunami', 'flood'].includes(form.eventType) && !form.gdacsId && (
                <div style={{ marginBottom: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <Warning size={14} color="#f59e0b" />
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

              {/* ALERT LEVEL / WARNING SIGNAL (Hidden for GDACS events and Typhoons) */}
              {!form.gdacsId && form.eventType !== 'typhoon' && (
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
              )}

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

              {/* AFFECTED BARANGAYS (Manual Entry) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LABEL_STYLE}>Affected Barangays (Community Impact)</label>
                <textarea
                  placeholder="List down affected barangays or specific areas (e.g., Brgy. San Juan, Zone 4)..."
                  value={form.affectedBarangays}
                  onChange={e => setForm(f => ({ ...f, affectedBarangays: e.target.value }))}
                  style={{ 
                    ...INPUT_STYLE, 
                    height: '80px', 
                    resize: 'none', 
                    fontSize: '0.8125rem',
                    lineHeight: '1.5',
                    background: '#fafafa'
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>
                  Detail specific communities for localized SITREP tracking.
                </p>
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
                    <Trash size={16} style={{ marginRight: '6px' }} /> Delete Event
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
                  <PaperPlaneRight size={16} />
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
              <div className="modal-confirm-icon modal-confirm-icon--danger"><Warning size={28} /></div>
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
