import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { Plus, Calendar, Pencil, Trash, PaperPlaneRight, Warning, CheckCircle, X, Info, CaretDown, CaretUp, ArrowsClockwise, Globe, ArrowRight, Hurricane, Waves, Waveform, CloudWarning, Drop, WarningCircle, Broadcast, Clock, MagnifyingGlass } from '@phosphor-icons/react'
import { useEvents } from '../contexts/EventContext'
import LoadingSpinner from '../components/LoadingSpinner'
import HeaderFooterModal from '../components/HeaderFooterModal'
import ConfirmationModal from '../components/ConfirmationModal'
import Button from '../components/Button'
import { PROVINCE_NAMES, PROVINCES_WITH_CITIES, getCitiesForProvince, getProvinceForCity } from '../data/provinces'
import regionData from '../data/region1_barangays.json'
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
  { value: 'typhoon',    label: 'Tropical Cyclone',        Icon: TyphoonIcon },
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
  const { 
    events, addEvent, updateEvent, deleteEvent, deployEvent, 
    fetchEventSignals, assignSignal, bulkAssignSignals, 
    eventSignals, loadingSignals, loading, showConfirm, showSuccess, showToast
  } = useEvents()

  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('startDate')
  const [sortAsc, setSortAsc] = useState(false)

  const [showModal, setShowModal] = useState(false)
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
    affectedBarangays: '',
  })

  const [activeSignalTab, setActiveSignalTab] = useState('provinces') // provinces, lgus, barangays
  const [modalMode, setModalMode] = useState('view') // view, edit
  const [signalSearchTerm, setSignalSearchTerm] = useState('')
  const [selectedSignalProvince, setSelectedSignalProvince] = useState('')
  const [selectedSignalCity, setSelectedSignalCity] = useState('')

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
  const blankForm = () => {
    let defaultProvinces = []
    if (user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin') {
      const p = user.province || getProvinceForCity(user.city)
      if (p) {
        const matchedProv = PROVINCE_NAMES.find(n => n.toLowerCase() === p.toLowerCase())
        if (matchedProv) defaultProvinces = [matchedProv]
      }
    }
    return {
      name: '', color: '#6366f1',
      startDate: new Date().toISOString().slice(0, 16),
      endDate: '', eventType: 'typhoon', alertStatus: 'white', alertLevel: '',
      summary: '', affectedProvinces: defaultProvinces,
      typhoonCategory: '',
      magnitude: '', intensity: '',
      waveHeight: '', tsunamiAlert: '',
      floodLevel: '', rainfall: '',
      affectedBarangays: '',
      pendingSignals: {},
    }
  }

  const openAddModal = () => {
    setEditingId(null)
    setForm(blankForm())
    setModalMode('edit')
    setShowModal(true)
  }

  const openDetailsModal = async (event) => {
    setEditingId(event.id)
    setModalMode('view')
    
    // Fetch signals for this event - fetchEventSignals internally handles loadingSignals and setEventSignals
    await fetchEventSignals(event.id)

    // Determine initial signal tab based on role
    const isProvincial = user.account_type === 'Provincial' || user.account_type === 'Provincial Admin'
    const isLGU = user.account_type === 'LGU' || user.account_type === 'LGU Admin'
    
    if (isProvincial) setActiveSignalTab('lgus')
    else if (isLGU) setActiveSignalTab('barangays')
    else setActiveSignalTab('provinces')

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
    if (!form.name.trim()) {
      showSuccess('Validation Error', 'Please enter an Event Name.')
      return null
    }
    if (form.eventType === 'earthquake' && !form.magnitude) {
      showSuccess('Validation Error', 'Please enter the Magnitude.')
      return null
    } else if (form.eventType !== 'earthquake' && ALERT_LEVELS[form.eventType]?.length > 0 && !form.typhoonCategory) {
      showSuccess('Validation Error', 'Please select a Specific Alert Level / Category.')
      return null
    }
    if (form.affectedProvinces.length === 0) {
      showSuccess('Validation Error', 'Please select at least one province for the Deployment Scope.')
      return null
    }
    if (!form.startDate) {
      showSuccess('Validation Error', 'Please select a Start Date & Time.')
      return null
    }
    
    showConfirm({
      title: editingId ? 'Update Event' : 'Create Event',
      message: `Are you sure you want to ${editingId ? 'save changes to' : 'create'} the event "${form.name}"?`,
      onConfirm: async () => {
        // Auto-generate summary if empty
        let finalSummary = form.summary
        if (!finalSummary) {
          if (form.eventType === 'typhoon') {
            finalSummary = `**TROPICAL CYCLONE ${form.name.toUpperCase()}**\n\n* **Category**: ${form.typhoonCategory || 'Monitoring'}\n* **Status**: ${form.alertStatus.toUpperCase()}`
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
        if (form.eventType === 'earthquake') {
          payload.alertLevel = form.magnitude ? `Magnitude ${form.magnitude}` : 'Monitoring'
        }

        let resultId = null
        if (editingId) {
          await updateEvent(editingId, payload)
          resultId = editingId
        } else {
          const newEvent = await addEvent(payload)
          resultId = newEvent?.id
          
          // Batch assign pending signals
          if (resultId && form.pendingSignals) {
            for (const [prov, sig] of Object.entries(form.pendingSignals)) {
              await assignSignal(resultId, prov, '', '', sig)
            }
          }
        }
        
        // Close modal first for immediate feedback
        if (shouldClose) setShowModal(false)
      }
    })
    return null
  }

  const handleToggleProvince = (prov) => {
    setForm(prev => ({
      ...prev,
      affectedProvinces: prev.affectedProvinces.includes(prov)
        ? prev.affectedProvinces.filter(p => p !== prov)
        : [...prev.affectedProvinces, prov]
    }))
  }

  const handleAssignSignal = async (location, signal) => {
    let province = ''
    let city = ''
    let barangay = ''

    if (activeSignalTab === 'provinces') {
      province = location
    } else if (activeSignalTab === 'lgus') {
      province = (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') ? (selectedSignalProvince || getProvinceForCity(location)) : user.province
      city = location
    } else if (activeSignalTab === 'barangays') {
      province = (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') ? (selectedSignalProvince || getProvinceForCity(selectedSignalCity || '')) : user.province
      city = (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') ? (selectedSignalCity || '') : user.city
      barangay = location
    }

    if (editingId) {
      const success = await assignSignal(editingId, province, city, barangay, signal)
      if (success) {
        await fetchEventSignals(editingId)
      }
    } else {
      setForm(f => {
        const newSignals = { ...(f.pendingSignals || {}) }
        if (signal === null) delete newSignals[location]
        else newSignals[location] = signal
        return { ...f, pendingSignals: newSignals }
      })
    }
  }

  const handleApplyAll = async (signal) => {
    const provinceToApply = (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') ? selectedSignalProvince : user.province;
    if (!editingId || !provinceToApply || activeSignalTab !== 'lgus') return
    
    const locations = [...new Set(getCitiesForProvince(provinceToApply))]
    if (locations.length === 0) return
    
    const success = await bulkAssignSignals(editingId, provinceToApply, locations, signal)
    if (success) {
      await fetchEventSignals(editingId)
    }
  }

  const SIGNAL_COLORS = {
    '1': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }, // Yellow
    '2': { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' }, // Orange
    '3': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }, // Red
    '4': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }, // Pink
    '5': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' }, // Purple
  }

  const confirmDelete = async () => {
    showConfirm({
      title: 'Delete Event?',
      message: `Are you sure you want to delete "${form.name}"? This action cannot be undone and all associated report data will be permanently removed.`,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        if (editingId) await deleteEvent(editingId)
        setShowModal(false)
      }
    })
  }

  const handleDeploy = (event) => {
    showConfirm({
      title: 'Deploy Event?',
      message: `Are you sure you want to deploy "${event.name}"? This will make it the active event on the dashboard and notify all affected provinces.`,
      confirmText: 'Yes, Deploy Now',
      type: 'primary',
      onConfirm: () => deployEvent(event.id)
    })
  }

  const SortBtn = ({ colKey, label }) => (
    <Button variant="ghost" onClick={() => handleSort(colKey)} className="consolidated-th-sort">
      {label}
      {sortKey === colKey
        ? (sortAsc ? <CaretUp size={13} className="consolidated-sort-icon" /> : <CaretDown size={13} className="consolidated-sort-icon" />)
        : <CaretDown size={13} className="consolidated-sort-icon inactive" />}
    </Button>
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
             <div className="consolidated-report-search-box">
               <SearchInput placeholder="Search incidents..." value={searchTerm} onChange={val => { setSearchTerm(val); setCurrentPage(1) }} />
             </div>
             {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
               <Button 
                 variant="solid" 
                 color="primary" 
                 onClick={openAddModal} 
                 style={{ height: '42px', padding: '0 20px', fontWeight: 700 }}
                 leftIcon={<Plus size={18} weight="bold" />}
               >
                 New Event
               </Button>
             )}
           </div>
        </div>

        {/* Section Label */}
        <div style={{ padding: '1rem 1.75rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.25)' }}>
          {/* Removed redundant Events label */}
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
                <th className="col-action" style={{ textAlign: 'center' }}>ACTIONS</th>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      {!event.isDeployed && (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
                        <Button 
                          variant="solid"
                          color="success"
                          size="sm"
                          onClick={() => handleDeploy(event)} 
                          leftIcon={<PaperPlaneRight size={14} weight="fill" />}
                        >
                          Deploy
                        </Button>
                      )}
                      <Button 
                        variant="solid"
                        color="info"
                        size="sm"
                        onClick={() => openDetailsModal(event)} 
                        leftIcon={<Info size={14} weight="bold" />}
                      >
                        View Details
                      </Button>
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
          <Button
            variant="subtle"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &lt; Previous
          </Button>
          <div className="consolidated-report-pagination-numbers">

          </div>
          <Button
            variant="subtle"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </Button>
        </div>
      </div>

      {/* ══════════════ ADD / EDIT EVENT MODAL ══════════════ */}
      <HeaderFooterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '8px', borderRadius: '10px' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>
                {editingId ? (modalMode === 'view' ? 'Event Details' : 'Edit Event') : 'Add Event'}
              </div>
            </div>
          </div>
        }
        subtitle={editingId ? (modalMode === 'view' ? 'View summary and status of this event.' : 'Manage hierarchy and signals for this event.') : 'Define the details and timing for this event context.'}
        maxWidth="660px"
        headerActions={null}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div>
               {editingId && (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
                 <Button 
                   variant="outline" 
                   color="danger"
                   onClick={confirmDelete}
                   style={{ height: '42px', padding: '0 16px' }}
                   leftIcon={<Trash size={16} />}
                 >
                   Delete Event
                 </Button>
               )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="subtle" onClick={() => setShowModal(false)} style={{ height: '42px', padding: '0 20px' }}>
                {modalMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              
              {modalMode === 'view' ? (
                <>
                  {editingId && !events.find(e => e.id === editingId)?.isDeployed && (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
                    <Button 
                      variant="solid"
                      color="success"
                      onClick={() => handleDeploy(events.find(e => e.id === editingId))}
                      style={{ height: '42px', padding: '0 20px' }}
                      leftIcon={<PaperPlaneRight size={16} weight="fill" />}
                    >
                      Deploy
                    </Button>
                  )}
                  {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || user.account_type === 'Provincial Admin' || user.account_type === 'Provincial' || user.account_type === 'LGU Admin' || user.account_type === 'LGU') && (
                    <Button 
                      variant="solid"
                      color="primary"
                      onClick={() => setModalMode('edit')}
                      style={{ height: '42px', padding: '0 24px' }}
                      leftIcon={<Pencil size={16} />}
                    >
                      Edit
                    </Button>
                  )}
                </>
              ) : (
                <Button 
                  variant="solid"
                  color="primary"
                  onClick={(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || !editingId) ? handleSubmit : () => setModalMode('view')} 
                  disabled={(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || !editingId) && !form.name.trim()}
                  style={{ height: '42px', padding: '0 24px' }}
                  leftIcon={<CheckCircle size={18} weight="fill" />}
                >
                  {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || !editingId) ? (editingId ? 'Save Changes' : 'Create Event') : 'Done Editing'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* ══════════════ DETAILS VIEW (SUMMARY) ══════════════ */}
          {editingId && (modalMode === 'view' || (user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin')) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Event Summary Card */}
              <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ background: form.color || '#6366f1', padding: '16px 20px', color: 'white' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>Event Name</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{form.name}</div>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={LABEL_STYLE}>Category</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 700 }}>
                       {(() => {
                         const CatIcon = EVENT_CATEGORIES.find(c => c.value === form.eventType)?.Icon || OtherIcon;
                         return <CatIcon />;
                       })()}
                       <span style={{ textTransform: 'capitalize' }}>{form.eventType}</span>
                    </div>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>{form.eventType === 'earthquake' ? 'Magnitude' : 'Alert Level'}</label>
                    <span className={alertPillClass(form.alertStatus)} style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '20px' }}>
                      {form.eventType === 'earthquake'
                        ? (form.magnitude || 'Monitoring').toUpperCase()
                        : (form.typhoonCategory || form.alertLevel || 'Monitoring').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Start Date</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.875rem' }}>
                      <Calendar size={16} weight="duotone" />
                      {form.startDate ? new Date(form.startDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </div>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>End Date</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.875rem' }}>
                      <Clock size={16} weight="duotone" />
                      {form.endDate ? new Date(form.endDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ongoing'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Affected Provinces */}
              <div>
                <label style={LABEL_STYLE}>Deployment Scope</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {form.affectedProvinces.length > 0 ? form.affectedProvinces.map(prov => (
                    <span key={prov} style={{ padding: '4px 12px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 700 }}>
                      {prov}
                    </span>
                  )) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No provinces selected</span>}
                </div>
              </div>
              
              {/* Summary Text */}
              {form.summary && (
                <div>
                  <label style={LABEL_STYLE}>Summary Overview</label>
                  <div style={{ 
                    background: '#f1f5f9', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    fontSize: '0.875rem', 
                    lineHeight: 1.6, 
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid #e2e8f0'
                  }}>
                    {form.summary.replace(/\*\*/g, '').replace(/\*/g, '•')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ EDIT FORM FIELDS (REGIONAL ONLY) ══════════════ */}
          {((modalMode === 'edit' && (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin')) || !editingId) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={LABEL_STYLE}>Category</label>
                <div className="event-category-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {EVENT_CATEGORIES.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, eventType: value })}
                      disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                      style={{
                        padding: '12px 8px', borderRadius: '12px', border: '1.5px solid',
                        borderColor: form.eventType === value ? '#6366f1' : '#f1f5f9',
                        background: form.eventType === value ? 'rgba(99,102,241,0.05)' : 'white',
                        color: form.eventType === value ? '#6366f1' : '#64748b',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <Icon />
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LABEL_STYLE}>Event Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tropical Cyclone EGAY (DOKSURI)"
                    value={form.name}
                    onChange={e => {
                      const val = e.target.value;
                      setForm({ ...form, name: val.charAt(0).toUpperCase() + val.slice(1) });
                    }}
                    style={INPUT_STYLE}
                    disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LABEL_STYLE}>Alert Color Status</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    {[
                      { value: 'red', label: 'Red (Critical)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#fca5a5', text: '#b91c1c' },
                      { value: 'blue', label: 'Blue (Standard)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: '#bfdbfe', text: '#1d4ed8' },
                      { value: 'white', label: 'White (Normal)', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#475569' }
                    ].map(item => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setForm({ ...form, alertStatus: item.value, color: item.color })}
                        disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid',
                          borderColor: form.alertStatus === item.value ? item.color : '#e2e8f0',
                          background: form.alertStatus === item.value ? item.bg : 'white',
                          color: form.alertStatus === item.value ? item.text : '#475569',
                          fontSize: '0.8125rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          opacity: (editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin') ? 0.7 : 1
                        }}
                      >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LABEL_STYLE}>
                    {form.eventType === 'earthquake' ? 'Magnitude' : 'Specific Alert Level / Category'}
                  </label>
                  {form.eventType === 'earthquake' ? (
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 5.6"
                      value={form.magnitude}
                      onChange={e => setForm({ ...form, magnitude: e.target.value })}
                      style={INPUT_STYLE}
                      disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {ALERT_LEVELS[form.eventType]?.map(lvl => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setForm({ ...form, typhoonCategory: lvl.value })}
                          disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                          title={lvl.desc}
                          style={{
                            padding: '10px 14px', borderRadius: '10px', border: '1.5px solid',
                            borderColor: form.typhoonCategory === lvl.value ? '#6366f1' : '#f1f5f9',
                            background: form.typhoonCategory === lvl.value ? 'rgba(99,102,241,0.05)' : '#f8fafc',
                            color: form.typhoonCategory === lvl.value ? '#6366f1' : '#475569',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          {lvl.label}
                        </button>
                      )) || <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>No levels defined for this category</span>}
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PaperPlaneRight size={18} weight="duotone" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Deployment Scope</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>Select affected provinces to deploy this event context.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {PROVINCE_NAMES.map(prov => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => handleToggleProvince(prov)}
                        disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                        style={{
                          flex: 1, padding: '14px 10px', borderRadius: '12px', border: '1.5px solid',
                          borderColor: form.affectedProvinces.includes(prov) ? '#6366f1' : '#f1f5f9',
                          background: form.affectedProvinces.includes(prov) ? 'rgba(99,102,241,0.05)' : 'white',
                          color: form.affectedProvinces.includes(prov) ? '#6366f1' : '#64748b',
                          fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          opacity: (editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin') ? 0.7 : 1
                        }}
                      >
                        {form.affectedProvinces.includes(prov) && <CheckCircle size={16} weight="fill" />}
                        {prov}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EVENT TIME (EDIT MODE - REGIONAL ONLY) */}
          {modalMode === 'edit' && (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <label style={LABEL_STYLE}>Event Time</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#94a3b8" />
                  <ModernDateTimePicker
                    value={form.startDate}
                    onChange={val => setForm({ ...form, startDate: val })}
                    placeholder="Start Date & Time"
                    disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#94a3b8" />
                  <ModernDateTimePicker
                    value={form.endDate}
                    onChange={val => setForm({ ...form, endDate: val })}
                    placeholder="End Date & Time (Optional)"
                    disabled={editingId && user.account_type !== 'Regional Admin' && user.account_type !== 'Super Admin'}
                  />
                </div>
              </div>
            </div>
          )}


          {/* HIERARCHICAL SIGNALS MANAGEMENT */}
          {editingId && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <MagnifyingGlass size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="text"
                    placeholder={`Search ${activeSignalTab === 'lgus' ? 'LGUs' : activeSignalTab === 'barangays' ? 'Barangays' : 'Provinces'}...`}
                    value={signalSearchTerm}
                    onChange={(e) => setSignalSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.8125rem',
                      background: '#f8fafc',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                  {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && (
                    <Button 
                      variant={activeSignalTab === 'provinces' ? 'solid' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveSignalTab('provinces')}
                    >Region</Button>
                  )}
                  {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || user.account_type === 'Provincial Admin' || user.account_type === 'Provincial') && (
                    <Button 
                      variant={activeSignalTab === 'lgus' ? 'solid' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveSignalTab('lgus')}
                    >Province</Button>
                  )}
                  {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || user.account_type === 'LGU Admin' || user.account_type === 'LGU') && (
                    <Button 
                      variant={activeSignalTab === 'barangays' ? 'solid' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveSignalTab('barangays')}
                    >LGU</Button>
                  )}
                </div>
              </div>

              {(user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') && activeSignalTab !== 'provinces' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LABEL_STYLE, marginBottom: '4px', fontSize: '0.6rem' }}>Select Province</label>
                    <select 
                      value={selectedSignalProvince}
                      onChange={(e) => { setSelectedSignalProvince(e.target.value); setSelectedSignalCity('') }}
                      style={{ ...SELECT_STYLE, padding: '6px 10px', fontSize: '0.75rem' }}
                    >
                      <option value="">-- All Affected --</option>
                      {form.affectedProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {activeSignalTab === 'barangays' && (
                    <div style={{ flex: 1 }}>
                      <label style={{ ...LABEL_STYLE, marginBottom: '4px', fontSize: '0.6rem' }}>Select LGU</label>
                      <select 
                        value={selectedSignalCity}
                        onChange={(e) => setSelectedSignalCity(e.target.value)}
                        style={{ ...SELECT_STYLE, padding: '6px 10px', fontSize: '0.75rem' }}
                        disabled={!selectedSignalProvince}
                      >
                        <option value="">-- All in Province --</option>
                        {selectedSignalProvince && getCitiesForProvince(selectedSignalProvince).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    {activeSignalTab === 'provinces' ? 'Provincial Level (Region)' : activeSignalTab === 'lgus' ? `LGU Level (Province)` : `Barangay Level (LGU)`}
                  </span>

                  {activeSignalTab === 'lgus' && modalMode === 'edit' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Apply to All:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleApplyAll(s)}
                            disabled={modalMode === 'view'}
                            className="apply-all-btn"
                            style={{
                              width: '24px', height: '24px', borderRadius: '4px',
                              background: 'white', color: '#64748b', border: '1px solid #e2e8f0',
                              fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s',
                              opacity: modalMode === 'view' ? 0.5 : 1
                            }}
                          >
                            {s}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleApplyAll(null)}
                          disabled={modalMode === 'view'}
                          style={{
                            width: '24px', height: '24px', borderRadius: '4px',
                            background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                            fontSize: '0.7rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: modalMode === 'view' ? 0.5 : 1
                          }}
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  {loadingSignals ? <div style={{ padding: '30px', textAlign: 'center' }}><LoadingSpinner size={24} /></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(
                        [...new Set(
                          activeSignalTab === 'provinces' ? form.affectedProvinces :
                          activeSignalTab === 'lgus' ? (
                            (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin') 
                              ? (selectedSignalProvince ? getCitiesForProvince(selectedSignalProvince) : form.affectedProvinces.flatMap(p => getCitiesForProvince(p)))
                              : (user.province ? getCitiesForProvince(user.province) : [])
                          ) :
                          (activeSignalTab === 'barangays' ? (
                            (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin')
                              ? (selectedSignalCity ? (regionData.provinces.find(p => p.name === selectedSignalProvince)?.cities?.find(c => c.name === selectedSignalCity)?.barangays || regionData.provinces.find(p => p.name === selectedSignalProvince)?.municipalities?.find(c => c.name === selectedSignalCity)?.barangays || []) : [])
                              : (user.province && user.city ? (regionData.provinces.find(p => p.name === user.province)?.cities?.find(c => c.name === user.city)?.barangays || regionData.provinces.find(p => p.name === user.province)?.municipalities?.find(c => c.name === user.city)?.barangays || []) : [])
                          ) : [])
                        )].filter(loc => loc && loc.toLowerCase().includes(signalSearchTerm.toLowerCase()))
                      ).map(loc => {
                        const signalData = eventSignals.find(s => {
                          if (activeSignalTab === 'provinces') return s.province === loc && !s.city
                          if (activeSignalTab === 'lgus') return s.city?.toLowerCase() === loc?.toLowerCase() && !s.barangay
                          if (activeSignalTab === 'barangays') return s.barangay?.toLowerCase() === loc?.toLowerCase()
                          return false
                        })
                        const currentSignal = editingId ? signalData?.signal : (activeSignalTab === 'provinces' ? form.pendingSignals?.[loc] : null)
                        const canEdit = activeSignalTab === 'provinces' 
                          ? (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin')
                          : activeSignalTab === 'lgus'
                          ? (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || user.account_type === 'Provincial Admin' || user.account_type === 'Provincial')
                          : (user.account_type === 'Regional Admin' || user.account_type === 'Super Admin' || user.account_type === 'LGU Admin' || user.account_type === 'LGU');

                        return (
                          <div key={loc} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>{loc}</span>
                            
                            {modalMode === 'view' ? (
                              <div style={{ 
                                padding: '4px 12px', borderRadius: '20px',
                                background: currentSignal ? SIGNAL_COLORS[currentSignal].bg : '#f1f5f9',
                                color: currentSignal ? SIGNAL_COLORS[currentSignal].text : '#94a3b8',
                                fontSize: '0.75rem', fontWeight: 800,
                                border: `1px solid ${currentSignal ? SIGNAL_COLORS[currentSignal].border : '#e2e8f0'}`,
                                minWidth: '80px', textAlign: 'center'
                              }}>
                                {currentSignal ? `Signal ${currentSignal}` : 'No Signal'}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleAssignSignal(loc, String(s))}
                                    disabled={!canEdit}
                                    style={{
                                      width: '28px', height: '28px', borderRadius: '6px',
                                      background: String(s) === currentSignal ? SIGNAL_COLORS[s].bg : 'white',
                                      color: String(s) === currentSignal ? SIGNAL_COLORS[s].text : '#94a3b8',
                                      border: `1.5px solid ${String(s) === currentSignal ? SIGNAL_COLORS[s].border : '#f1f5f9'}`,
                                      fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      opacity: !canEdit ? 0.6 : 1
                                    }}
                                  >
                                    {s}
                                  </button>
                                ))}
                                <Button variant="ghost" size="sm" color="danger" onClick={() => handleAssignSignal(loc, null)} icon={<X size={14} />} style={{ width: '28px', height: '28px' }} disabled={!canEdit} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </HeaderFooterModal>

    </div>
  )
}
