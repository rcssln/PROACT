import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useLocation, useOutletContext } from 'react-router-dom'
import { FilePlus, Plus, Trash, X, Eye, PencilSimple, Upload, PaperPlaneRight, CaretDown, CaretUp, ArrowLeft, Lightning, Drop, Warning, CloudRain, Info, ShieldWarning, Phone, HardHat, House, FileText, CalendarX, Handshake, Users, Pulse, FileArrowDown, ChartBar, ArrowsClockwise, Check, CheckCircle, Sparkle, Download, ArrowSquareOut, FileXls, ClockCounterClockwise, FloppyDisk } from '@phosphor-icons/react'
import SearchInput from '../components/SearchInput'
import SearchableSelect from '../components/SearchableSelect'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import { useEvents } from '../contexts/EventContext'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'
import { LGU_NAMES, getBarangaysForCity, getCityForBarangay, getLguNames } from '../data/locations'
import { getProvinceForCity, PROVINCE_NAMES } from '../data/provinces'
import { generateRelatedIncidentsPdf } from '../lib/generateRelatedIncidentsPdf'
import { generateConsolidatedCsv } from '../lib/generateConsolidatedCsv'
import { generateAISummary, generateSummary } from '../openai/summaryService'
import { createPortal } from 'react-dom'
import HeaderFooterModal from '../components/HeaderFooterModal'
import ConfirmationModal from '../components/ConfirmationModal'
import '../styles/pages/PageStyles.css'
import '../styles/pages/AddReport.css'
import '../styles/components/DownloadModals.css'

const CATEGORY_LABELS = {
  relatedIncidents: 'Related Incidents',
  affectedPopulation: 'Affected Population',
  roadsAndBridges: 'Roads and Bridges',
  power: 'Power',
  waterSupply: 'Water Supply',
  communicationLines: 'Communication Lines',
  damagedHouses: 'Damaged Houses',
  classSuspension: 'Class Suspension',
  workSuspension: 'Work Suspension',
  stateOfCalamity: 'Declaration of State of Calamity',
  preEmptiveEvacuation: 'Pre-emptive Evacuation',
  assistanceProvided: 'Assistance Provided to Affected Families',
}

const CATEGORY_NAMES = Object.keys(CATEGORY_LABELS).map(key => ({
  id: key,
  label: CATEGORY_LABELS[key]
}))

const CATEGORY_TO_TABLE = {
  evacuation: 'reports',
  assistance_lgus: 'assistance_lgus_agencies_reports',
  agriculture: 'agriculture_damage_reports',
  infrastructure: 'infrastructure_damage_reports',
  power: 'power_reports',
  water: 'water_supply_reports',
  roads: 'roads_and_bridges',
  communication: 'communication_lines_reports',
  incidents: 'related_incidents',
  houses: 'damaged_houses_reports',
  class: 'class_suspension_reports',
  work: 'work_suspension_reports',
  calamity: 'declaration_state_of_calamity_reports',
  preemptive: 'pre_emptive_evacuation_reports',
  assistance: 'assistance_provided_reports'
}


const PAGE_SIZES = [10, 25, 50]

const REPORT_CATEGORIES = [
   { id: 'evacuation', title: 'Affected Population', icon: <Users size={24} />, color: '#3b82f6', description: 'Track families/persons in/out of ECs' },
  { id: 'assistance_lgus', title: 'Assistance (LGUs/Agencies)', icon: <Handshake size={24} />, color: '#10b981', description: 'Relief and assistance from LGUs and other agencies' },
  { id: 'agriculture', title: 'Agriculture Damage', icon: <Lightning size={24} />, color: '#f59e0b', description: 'Damage and losses to agriculture' },
  { id: 'infrastructure', title: 'Infrastructure Damage', icon: <HardHat size={24} />, color: '#6366f1', description: 'Damage to roads, bridges, and other infrastructure' },
  { id: 'power', title: 'Power Status', icon: <Lightning size={24} />, color: '#f97316', description: 'Monitor interruptions and restoration' },
  { id: 'water', title: 'Water Status', icon: <Drop size={24} />, color: '#0ea5e9', description: 'Monitor water supply availability' },
  { id: 'roads', title: 'Roads & Bridges', icon: <Pulse size={24} />, color: '#6366f1', description: 'Passability of major thoroughfares' },
  { id: 'communication', title: 'Communication', icon: <Phone size={24} />, color: '#14b8a6', description: 'Mobile and internet connectivity' },
  { id: 'incidents', title: 'Related Incidents', icon: <Warning size={24} />, color: '#ef4444', description: 'Floods, landslides, and fire' },
  { id: 'houses', title: 'Damaged Houses', icon: <House size={24} />, color: '#f43f5e', description: 'Totally and partially damaged homes' },
  { id: 'class', title: 'Class Suspension', icon: <CalendarX size={24} />, color: '#8b5cf6', description: 'School/Class cancellation logs' },
  { id: 'work', title: 'Work Suspension', icon: <FileText size={24} />, color: '#64748b', description: 'Government/Private work status' },
   { id: 'calamity', title: 'State of Calamity', icon: <ShieldWarning size={24} />, color: '#d946ef', description: 'Official LGU calamity declarations' },
  { id: 'preemptive', title: 'Pre-emptive Evac', icon: <Pulse size={24} />, color: '#f59e0b', description: 'Early evacuation demographic data' },
  { id: 'assistance', title: 'Assistance Provided', icon: <Handshake size={24} />, color: '#10b981', description: 'Relief distribution and PNFI' },
]

const emptyRow = (catId = 'evacuation', city = '') => {
  const base = { city: city || '', barangay: '', remarks: '' }
  switch (catId) {
    case 'evacuation':
      return {
        ...base,
        affectedFamilies: '', affectedPersons: '', ecsCum: '', ecsNow: '',
        insideFamiliesCum: '', insideFamiliesNow: '', insidePersonsCum: '', insidePersonsNow: '',
        outsideFamiliesCum: '', outsideFamiliesNow: '', outsidePersonsCum: '', outsidePersonsNow: '',
        status: ''
      }
    case 'power':
      return { ...base, type: 'Total', serviceProvider: '', dateInterruption: '', timeInterruption: '', dateRestored: '', timeRestored: '', status: 'Ongoing' }
    case 'water':
      return { ...base, type: 'Total', serviceProvider: '', dateInterruption: '', timeInterruption: '', dateRestored: '', timeRestored: '', status: 'Ongoing' }
    case 'roads':
      return { ...base, classification: 'National', roadBridgeName: '', status: 'Not Passable', datePassable: '', timePassable: '', dateNotPassable: '', timeNotPassable: '' }
    case 'incidents':
      return { ...base, typeOfIncident: '', dateOfOccurrence: '', timeOfOccurrence: '', description: '', actionsTaken: '', status: 'Ongoing' }
    case 'houses':
      return { ...base, totallyDamaged: '', partiallyDamaged: '', grandTotal: 0, amountPhp: '' }
    case 'class':
    case 'work':
      return { ...base, level: catId === 'class' ? 'All Levels' : '', typeOfSuspension: '', dateOfSuspension: '', timeOfSuspension: '', dateOfResumption: '', timeOfResumption: '' }
    case 'calamity':
      return { ...base, type: '', countSoc: '', resolutionNo: '', resolutionDate: '' }
    case 'preemptive':
      return { ...base, families: '', maleCount: '', femaleCount: '', total: 0 }
    case 'assistance':
      return { ...base, noFamiliesAffected: '', noFamiliesRequiringAssistance: '', needs: '', fnfiQty: '', fnfiUnit: '', fnfiCostPerUnit: '', fnfiAmount: '', fnfiSource: '', noFamiliesAssisted: '', pctFamiliesAssisted: 0 }
    case 'communication':
      return {
        ...base, telecompany: '', statusOfCommunication: '', dateInterruption: '', timeInterruption: '', dateRestoration: '', timeRestoration: '',
        siteCount2g: '', withCoverage2g: '', pctCoverage2g: '', displayCoverage2g: '',
        siteCount3g: '', withCoverage3g: '', pctCoverage3g: '', displayCoverage3g: '',
        siteCount4g: '', withCoverage4g: '', pctCoverage4g: '', displayCoverage4g: ''
      }
    case 'assistance_lgus':
      return { ...base, type: '', qty: '', unit: '', costPerUnit: '', amount: '', source: '', status: 'Ongoing' }
    case 'agriculture':
      return { ...base, classification: 'Crop', type: '', farmersAffected: '', areaTotally: '', areaPartially: '', areaTotal: '', infraTotally: '', infraPartially: '', infraTotal: '', volumeLoss: '', valueLoss: '' }
    case 'infrastructure':
      return { ...base, type: '', classification: 'National', infrastructureName: '', numberDamaged: '', unit: '', quantity: '', cost: '', status: 'Ongoing' }
    default:
      return base
  }
}

// Convert app row to DB format
const rowToDb = (row) => ({
  barangay: row.barangay,
  remarks: row.remarks || '',
  affected_families: parseInt(row.affectedFamilies) || 0,
  affected_persons: parseInt(row.affectedPersons) || 0,
  ecs_cum: parseInt(row.ecsCum) || 0,
  ecs_now: parseInt(row.ecsNow) || 0,
  inside_families_cum: parseInt(row.insideFamiliesCum) || 0,
  inside_families_now: parseInt(row.insideFamiliesNow) || 0,
  inside_persons_cum: parseInt(row.insidePersonsCum) || 0,
  inside_persons_now: parseInt(row.insidePersonsNow) || 0,
  outside_families_cum: parseInt(row.outsideFamiliesCum) || 0,
  outside_families_now: parseInt(row.outsideFamiliesNow) || 0,
  outside_persons_cum: parseInt(row.outsidePersonsCum) || 0,
  outside_persons_now: parseInt(row.outsidePersonsNow) || 0,
  status: row.status || '',
  city: row.city || '',
})

// Convert DB row to app format
const dbRowToApp = (row, category = 'evacuation') => {
  let cleanBarangay = row.barangay || ''
  let remarks = row.remarks || ''
  
  // Legacy fallback: decode remarks from barangay if the remarks column is empty
  if (!remarks && cleanBarangay.includes('[REM:')) {
    const remMatch = cleanBarangay.match(/\[REM:(.*)\]/)
    if (remMatch) {
      remarks = remMatch[1]
      cleanBarangay = cleanBarangay.replace(remMatch[0], '').trim()
    }
  }

  const base = {
    id: row.id,
    report_id: row.report_id, 
    city: row.city || getCityForBarangay(cleanBarangay) || '',
    barangay: cleanBarangay,
    remarks: remarks,
    status: row.status || ''
  }

  switch (category) {
    case 'evacuation':
      return {
        ...base,
        affectedFamilies: row.affected_families?.toString() ?? '',
        affectedPersons: row.affected_persons?.toString() ?? '',
        ecsCum: row.ecs_cum?.toString() ?? '',
        ecsNow: row.ecs_now?.toString() ?? '',
        insideFamiliesCum: row.inside_families_cum?.toString() ?? '',
        insideFamiliesNow: row.inside_families_now?.toString() ?? '',
        insidePersonsCum: row.inside_persons_cum?.toString() ?? '',
        insidePersonsNow: row.inside_persons_now?.toString() ?? '',
        outsideFamiliesCum: row.outside_families_cum?.toString() ?? '',
        outsideFamiliesNow: row.outside_families_now?.toString() ?? '',
        outsidePersonsCum: row.outside_persons_cum?.toString() ?? '',
        outsidePersonsNow: row.outside_persons_now?.toString() ?? '',
        status: row.status ?? '',
      }
    case 'power':
      return {
        ...base,
        type: row.type || 'Total',
        serviceProvider: row.service_provider || '',
        dateInterruption: row.date_of_interruption || '',
        timeInterruption: row.time_of_interruption || '',
        dateRestored: row.date_restored || '',
        timeRestored: row.time_restored || '',
        status: row.status || 'Ongoing'
      }
    case 'water':
      return {
        ...base,
        type: row.type || 'Total',
        serviceProvider: row.service_provider || '',
        dateInterruption: row.date_of_interruption || '',
        timeInterruption: row.time_of_interruption || '',
        dateRestored: row.date_restored || '',
        timeRestored: row.time_restored || '',
        status: row.status || 'Ongoing'
      }
    case 'roads':
      return {
        ...base,
        classification: row.classification || 'National',
        roadBridgeName: row.road_bridge_name || '',
        status: row.status || 'Not Passable',
        dateNotPassable: row.date_reported_not_passable || '',
        timeNotPassable: row.time_reported_not_passable || '',
        datePassable: row.date_reported_passable || '',
        timePassable: row.time_reported_passable || ''
      }
    case 'communication':
      return {
        ...base,
        telecompany: row.telecompany || '',
        statusOfCommunication: row.status_of_communication || '',
        dateInterruption: row.date_interruption || '',
        timeInterruption: row.time_interruption || '',
        dateRestoration: row.date_restoration || '',
        timeRestoration: row.time_restoration || '',
        siteCount2g: row.site_count_2g?.toString() ?? '',
        withCoverage2g: row.with_coverage_2g?.toString() ?? '',
        pctCoverage2g: row.pct_coverage_2g || 0,
        displayCoverage2g: row.with_coverage_2g && row.site_count_2g ? `${row.with_coverage_2g}/${row.site_count_2g}` : '',
        siteCount3g: row.site_count_3g?.toString() ?? '',
        withCoverage3g: row.with_coverage_3g?.toString() ?? '',
        pctCoverage3g: row.pct_coverage_3g || 0,
        displayCoverage3g: row.with_coverage_3g && row.site_count_3g ? `${row.with_coverage_3g}/${row.site_count_3g}` : '',
        siteCount4g: row.site_count_4g?.toString() ?? '',
        withCoverage4g: row.with_coverage_4g?.toString() ?? '',
        pctCoverage4g: row.pct_coverage_4g || 0,
        displayCoverage4g: row.with_coverage_4g && row.site_count_4g ? `${row.with_coverage_4g}/${row.site_count_4g}` : ''
      }
    case 'incidents':
      return {
        ...base,
        typeOfIncident: row.type_of_incident || '',
        dateOfOccurrence: row.date_of_occurrence || '',
        timeOfOccurrence: row.time_of_occurrence || '',
        description: row.description || '',
        actionsTaken: row.actions_taken || '',
        status: row.status || 'Ongoing'
      }
    case 'houses':
      return {
        ...base,
        totallyDamaged: row.totally_damaged?.toString() ?? '',
        partiallyDamaged: row.partially_damaged?.toString() ?? '',
        grandTotal: row.grand_total || 0,
        amountPhp: row.amount_php?.toString() ?? ''
      }
    case 'class':
      return {
        ...base,
        level: row.level_from || 'All Levels',
        typeOfSuspension: row.type || '',
        dateOfSuspension: row.date_of_suspension || '',
        timeOfSuspension: row.time_of_suspension || '',
        dateOfResumption: row.date_resumed || '',
        timeOfResumption: row.time_resumed || '',
        status: row.status || 'Ongoing'
      }
    case 'work':
      return {
        ...base,
        typeOfSuspension: row.type || '',
        dateOfSuspension: row.date_of_suspension || '',
        timeOfSuspension: row.time_of_suspension || '',
        dateOfResumption: row.date_resumed || '',
        timeOfResumption: row.time_resumed || '',
        status: row.status || 'Ongoing'
      }
    case 'calamity':
      return {
        ...base,
        type: row.type || '',
        countSoc: row.count_soc?.toString() ?? '',
        resolutionNo: row.resolution_number || '',
        resolutionDate: row.resolution_date || ''
      }
    case 'preemptive':
      return {
        ...base,
        families: row.families?.toString() ?? '',
        maleCount: row.male_count?.toString() ?? '',
        femaleCount: row.female_count?.toString() ?? '',
        total: row.total || 0
      }
    case 'assistance':
      return {
        ...base,
        noFamiliesAffected: row.no_families_affected?.toString() ?? '',
        noFamiliesRequiringAssistance: row.no_families_requiring_assistance?.toString() ?? '',
        needs: row.needs || '',
        fnfiQty: row.fnfi_qty?.toString() ?? '',
        fnfiUnit: row.fnfi_unit || '',
        fnfiCostPerUnit: row.fnfi_cost_per_unit?.toString() ?? '',
        fnfiAmount: row.fnfi_amount?.toString() ?? '',
        fnfiSource: row.fnfi_source || '',
        noFamiliesAssisted: row.no_families_assisted?.toString() ?? '',
        pctFamiliesAssisted: row.pct_families_assisted || 0
      }
    case 'assistance_lgus':
      return {
        ...base,
        type: row.type || '',
        qty: row.qty?.toString() ?? '',
        unit: row.unit || '',
        costPerUnit: row.cost_per_unit?.toString() ?? '',
        amount: row.amount?.toString() ?? '',
        source: row.source || '',
        status: row.status || 'Ongoing'
      }
    case 'agriculture':
      return {
        ...base,
        classification: row.classification || 'Crop',
        type: row.type || '',
        farmersAffected: row.farmers_affected?.toString() ?? '',
        areaTotally: row.area_totally_damaged?.toString() ?? '',
        areaPartially: row.area_partially_damaged?.toString() ?? '',
        areaTotal: row.area_total?.toString() ?? '',
        infraTotally: row.infra_totally_damaged?.toString() ?? '',
        infraPartially: row.infra_partially_damaged?.toString() ?? '',
        infraTotal: row.infra_total?.toString() ?? '',
        volumeLoss: row.production_loss_volume?.toString() ?? '',
        valueLoss: row.production_loss_value?.toString() ?? '',
        status: row.status || 'Ongoing'
      }
    case 'infrastructure':
      return {
        ...base,
        type: row.type || '',
        classification: row.classification || 'National',
        infrastructureName: row.infrastructure_name || '',
        numberDamaged: row.number_damaged?.toString() ?? '',
        unit: row.unit || '',
        quantity: row.quantity?.toString() ?? '',
        cost: row.cost?.toString() ?? '',
        status: row.status || 'Ongoing'
      }
    default:
      return base
  }
}

const CAT_ID_TO_PING_KEY = {
  evacuation: 'affectedPopulation',
  assistance_lgus: 'assistanceLgus',
  agriculture: 'agricultureDamage',
  infrastructure: 'infrastructureDamage',
  power: 'power',
  water: 'waterSupply',
  roads: 'roadsAndBridges',
  communication: 'communicationLines',
  incidents: 'relatedIncidents',
  houses: 'damagedHouses',
  class: 'classSuspension',
  work: 'workSuspension',
  calamity: 'stateOfCalamity',
  preemptive: 'preEmptiveEvacuation',
  assistance: 'assistanceProvided',
}

const enrichReportItem = (item) => {
  const categoryInfo = REPORT_CATEGORIES.find(c => c.id === item.category)
  const categoryTitle = categoryInfo?.title || 'Report'
  const appItem = dbRowToApp(item, item.category)
  
  let subject = ''
  let summary = ''
  
  switch (item.category) {
    case 'power':
    case 'water':
      subject = appItem.serviceProvider || (item.category === 'power' ? 'Power Status' : 'Water Status')
      summary = `${appItem.type || 'Total'} | ${appItem.status || 'Ongoing'}`
      break
    case 'roads':
      subject = appItem.roadBridgeName || 'Road/Bridge'
      summary = `${appItem.classification || 'National'} | ${appItem.status || 'Not Passable'}`
      break
    case 'incidents':
      subject = appItem.typeOfIncident || 'Incident'
      summary = appItem.description || ''
      break
    case 'houses':
      const totally = parseInt(appItem.totallyDamaged) || 0
      const partially = parseInt(appItem.partiallyDamaged) || 0
      subject = `Houses: ${totally + partially} affected`
      summary = `Totally: ${totally}, Partially: ${partially}`
      break
    case 'class':
      subject = `Class Suspension: ${appItem.level || 'All Levels'}`
      summary = appItem.typeOfSuspension || ''
      break
    case 'work':
      subject = 'Work Suspension'
      summary = appItem.typeOfSuspension || ''
      break
    case 'calamity':
      subject = appItem.type || 'State of Calamity'
      summary = appItem.resolutionNo || ''
      break
    case 'preemptive':
      subject = `${appItem.families || 0} Families`
      summary = `${appItem.total || 0} Persons`
      break
    case 'assistance':
      subject = appItem.needs || 'Assistance Provided'
      summary = `${appItem.fnfiQty || ''} ${appItem.fnfiUnit || ''}`.trim()
      break
    case 'assistance_lgus':
      subject = appItem.type || 'LGU Assistance'
      summary = `${appItem.qty || ''} ${appItem.unit || ''} from ${appItem.source || ''}`.trim()
      break
    case 'agriculture':
      subject = appItem.type || 'Agriculture Damage'
      summary = `${appItem.farmersAffected || 0} farmers | ${appItem.classification || 'Crop'}`
      break
    case 'infrastructure':
      subject = appItem.infrastructureName || 'Infrastructure'
      summary = `${appItem.type || ''} | ${appItem.classification || 'National'}`
      break
    case 'communication':
      subject = appItem.telecompany || 'Communication'
      summary = appItem.statusOfCommunication || ''
      break
    default:
      subject = appItem.barangay || appItem.city || 'Entry'
      summary = appItem.remarks || ''
  }

  return {
    ...item,
    categoryTitle,
    categoryLabel: categoryTitle,
    location: item.barangay || item.city || 'Entry',
    subject,
    classification: subject,
    summary
  }
}

// Category Selection Modal Component
function CategorySelectionModal({ onClose, onSelect, pingedReportTypes = [], submittedCategories = new Set()}) {
  return (
    <HeaderFooterModal
      isOpen={true}
      onClose={onClose}
      title="Select Report Category"
      subtitle="Choose the type of data you wish to report"
      maxWidth="1100px"
      footer={<Button variant="subtle" onClick={onClose}>Cancel</Button>}
    >
      <div className="category-grid">
        {REPORT_CATEGORIES.map(cat => {
          const pingKey = CAT_ID_TO_PING_KEY[cat.id]
          const isPinged = pingedReportTypes.includes(pingKey)
          const isSubmitted = submittedCategories.has(cat.id)
          const showPing = isPinged && !isSubmitted

          return (
            <div
              key={cat.id}
              className="category-choice-card"
              onClick={() => onSelect(cat.id)}
              style={{ position: 'relative' }}
            >
              {showPing && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px #ffffff'
                }} title="Mandatory report is pending submission" />
              )}
              <div className="category-choice-icon" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                {cat.icon}
              </div>
              <div className="category-choice-info">
                <span className="category-choice-title">{cat.title}</span>
                <p className="category-choice-desc">{cat.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </HeaderFooterModal>
  )
}

export default function AddReport() {
  const { user } = useOutletContext() || {}
  const { events, currentEventId, openSelectEventModal, selectedEventForReport, showSuccess, showConfirm, notifications, showToast } = useEvents()

  const T = {
    blue: '#3b82f6',
    indigo: '#6366f1',
    teal: '#00c9a0',
    orange: '#f97316',
    red: '#ef4444',
    slate: '#64748b'
  }

  const unreadNotifs = useMemo(() => notifications?.filter(n => !n.is_read) || [], [notifications])

  const hasUnread = useCallback((eventId, sitrepId = null) => {
    return unreadNotifs.some(n => {
      let data = n.data
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (e) { 
          console.warn('Failed to parse notification data:', e)
          data = {} 
        }
      }
      
      const notifEventId = data?.event_id || data?.eventId
      const notifSitRepId = data?.sitrep_id || data?.sitrepId || data?.report_id || data?.reportId

      // Case 1: Looking for a specific SitRep red dot
      if (sitrepId) {
        return String(notifSitRepId) === String(sitrepId)
      }
      
      // Case 2: Looking for an Event-level red dot
      // Should trigger for assignments, rejections, submissions, or any event-linked notifications
      if (notifEventId && String(notifEventId) === String(eventId)) {
        return true
      }
      
      return false
    })
  }, [unreadNotifs])
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const pageTitle = pathname === '/affected-population' ? 'Affected Population' : 'Add Report'
  const defaultCity = user?.city ?? ''
  const [view, setView] = useState('events') // 'events', 'versions', or 'entries'
  const [selectedEvent, setSelectedEvent] = useState(null)
  const { currentSituationalReport, setCurrentSituationalReport, situationalReports, fetchSituationalReports, createSituationalReport, updateSituationalReport, sendSituationalReport, markSitRepNotificationsAsRead, markEventNotificationsAsRead } = useEvents()
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [activeCategoryModal, setActiveCategoryModal] = useState(null)
  
  // Filtering
  const [searchTerm, setSearchTerm] = useState('')
  
  const [rows, setRows] = useState([emptyRow()])
  const [unifiedForm, setUnifiedForm] = useState({})
  const [submittedReports, setSubmittedReports] = useState([])
  const [detailsModal, setDetailsModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('submittedAt')
  const [sortAsc, setSortAsc] = useState(false)
  const [textEditorModalData, setTextEditorModalData] = useState(null)
  const [showTextEditorModal, setShowTextEditorModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [deletedRowIds, setDeletedRowIds] = useState([])

  // New Sit Rep Modal State
  const [showNewSitRepModal, setShowNewSitRepModal] = useState(false)
  const [showEditSitRepModal, setShowEditSitRepModal] = useState(false)
  const [editingSitRep, setEditingSitRep] = useState(null)
  const [newSitRepTitle, setNewSitRepTitle] = useState('')
  const [pingedCategories, setPingedCategories] = useState([])
  const [shouldInheritData, setShouldInheritData] = useState(true)

  // Signatories State
  const [showSignatoriesModal, setShowSignatoriesModal] = useState(false)
  const [showDownloadTypeModal, setShowDownloadTypeModal] = useState(false)
  const [showPdfEditModal, setShowPdfEditModal] = useState(false)
  const [generatedSummaryData, setGeneratedSummaryData] = useState(null)
  const [aiGeneratedSummaryText, setAiGeneratedSummaryText] = useState('')
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState(null)
  const [downloadTypeModalInfo, setDownloadTypeModalInfo] = useState(null)
  const [summaryHistory, setSummaryHistory] = useState([])
  const [selectedHistoryId, setSelectedHistoryId] = useState('current')
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [isSavingSummary, setIsSavingSummary] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(true)
  const [signatoryRole, setSignatoryRole] = useState('preparedBy') // 'preparedBy', 'notedBy', 'approvedBy'
  const [signatorySearch, setSignatorySearch] = useState('')
  const [preparedBy, setPreparedBy] = useState([])
  const [notedBy, setNotedBy] = useState(null)
  const [approvedBy, setApprovedBy] = useState(null)
  const [availableSignatories, setAvailableSignatories] = useState([])
  const [loadingSignatories, setLoadingSignatories] = useState(false)
  const [signatoriesReturnToPdf, setSignatoriesReturnToPdf] = useState(false)
  const [processingExportId, setProcessingExportId] = useState(null)
  
  // Refs to track current state for async callbacks
  const preparedByRef = useRef([])
  const notedByRef = useRef(null)
  const approvedByRef = useRef(null)
  const pdfParamsRef = useRef(null)
  const aiSummaryTextRef = useRef('')

  useEffect(() => { preparedByRef.current = preparedBy }, [preparedBy])
  useEffect(() => { notedByRef.current = notedBy }, [notedBy])
  useEffect(() => { approvedByRef.current = approvedBy }, [approvedBy])
  useEffect(() => { aiSummaryTextRef.current = aiGeneratedSummaryText }, [aiGeneratedSummaryText])
  const [showApprovalUploadModal, setShowApprovalUploadModal] = useState(false)
  const [approvalFile, setApprovalFile] = useState(null)
  const [uploadingApproval, setUploadingApproval] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [showApprovalConfirmation, setShowApprovalConfirmation] = useState(false)
  const [approvalConfirmMessage, setApprovalConfirmMessage] = useState('')
  // Approver: PDF review modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewSitRep, setReviewSitRep] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [processingReview, setProcessingReview] = useState(false)
  const APPROVAL_BUCKET = 'consolidated-report-approvals'

  // LGU Submission state
  const [lguSubmissionStatus, setLguSubmissionStatus] = useState(null) // null | 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
  const [lguSubmissionRemarks, setLguSubmissionRemarks] = useState(null)
  const [submittingLgu, setSubmittingLgu] = useState(false)
  const currentGeneratingSitRepId = useRef(null)

  const isProvincial = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin'
  const isLGU = user?.account_type === 'LGU' || user?.account_type === 'LGU Admin'
  const isProvincialApprover = user?.account_type === 'Provincial Approver'
  const isRegional = user?.account_type === 'Regional' || user?.account_type === 'Regional Admin'
  console.log('DEBUG: AddReport Render', { 
    view, 
    showPdfEditModal, 
    hasBlob: !!pdfPreviewBlobUrl,
    blobUrl: pdfPreviewBlobUrl,
    sitRepId: generatedSummaryData?.situationalReportId 
  })
  const isSuperAdmin = user?.account_type === 'Super Admin' || user?.role === 'Super Admin'

  const userProvince = useMemo(() => {
    if (user?.province) return user.province;
    if (user?.city) return getProvinceForCity(user.city);
    return isSuperAdmin ? 'Region 1' : null;
  }, [user, isSuperAdmin]);

  // Clean up Blob URLs when they change or component unmounts
  useEffect(() => {
    console.log('DEBUG: pdfPreviewBlobUrl EFFECT triggered with value:', pdfPreviewBlobUrl)
    const url = pdfPreviewBlobUrl
    return () => {
      if (url && url.startsWith('blob:')) {
        console.log('DEBUG: Revoking old Blob URL:', url)
        URL.revokeObjectURL(url)
      }
    }
  }, [pdfPreviewBlobUrl])
  const filteredLguNames = useMemo(() => {
    return getLguNames(userProvince);
  }, [userProvince]);

  const [targetLgus, setTargetLgus] = useState([])
  const [selectedProvinces, setSelectedProvinces] = useState([])
  const [lguSearch, setLguSearch] = useState('')

  // --- RENDERING HELPERS ---

  const normalizeCity = (s) => (s || '').replace(/\s*\(.*\)\s*$/, '').replace(/^city\s+of\s+/i, '').trim().toLowerCase()

  const fetchReports = useCallback(async () => {
    if (!currentSituationalReport?.id) {
      setSubmittedReports([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data } = await api.get(`/reports/all-types?situational_report_id=${currentSituationalReport.id}`)
      
      // Group evacuation entries by report_id
      const grouped = []
      const evacuationByReport = {}

      data.forEach(item => {
        if (item.category === 'evacuation' && item.report_id) {
          if (!evacuationByReport[item.report_id]) {
            evacuationByReport[item.report_id] = []
          }
          evacuationByReport[item.report_id].push(item)
        } else {
          grouped.push(enrichReportItem(item))
        }
      })

      // Process grouped evacuation entries
      Object.keys(evacuationByReport).forEach(reportId => {
        const rows = evacuationByReport[reportId]
        const first = rows[0]
        
        // Use province name if all rows share it (look up if not in DB)
        const rowProvinces = rows.map(r => {
          if (r.province) return r.province
          const city = r.city || getCityForBarangay(r.barangay)
          return city ? getProvinceForCity(city) : null
        }).filter(Boolean)

        const uniqueProvinces = [...new Set(rowProvinces)]
        const provinceDisplay = uniqueProvinces.length === 1 ? uniqueProvinces[0] : 'Multiple Locations'

        grouped.push({
          id: reportId,
          report_id: reportId,
          category: 'evacuation',
          categoryTitle: 'Affected Population',
          categoryLabel: 'Affected Population',
          tableName: 'reports',
          location: provinceDisplay,
          subject: `${rows.length} Barangays Affected`,
          classification: `${rows.length} Barangays Affected`,
          summary: `Total Affected: ${rows.reduce((acc, r) => acc + (parseInt(r.affected_families) || 0), 0)} families`,
          status: first.status || 'Resolved',
          timestamp: first.timestamp,
          all_rows: rows
        })
      })

      const merged = grouped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      // LGU accounts: only show reports from barangays that belong to their city
      const isLgu = isLGU
      const lguCity = user?.city
      let finalReports = merged
      if (isLgu && lguCity) {
        const lguCityLow = normalizeCity(lguCity)
        const lguBarangays = new Set(
          getBarangaysForCity(lguCity).map(b => b.toLowerCase())
        )
        
        finalReports = merged.filter(r => {
          if (r.category === 'evacuation' && r.all_rows) {
            // For grouped evacuation, check if any row belongs to this LGU's city
            return r.all_rows.some(row => {
              const rowCity = normalizeCity(row.city || getCityForBarangay(row.barangay))
              return rowCity === lguCityLow
            })
          }
          const reportCity = normalizeCity(r.city || getCityForBarangay(r.barangay))
          const reportBarangay = (r.barangay || '').toLowerCase()
          return reportCity === lguCityLow || lguBarangays.has(reportBarangay)
        })
      }

      setSubmittedReports(finalReports)
    } catch (err) {
      setError(err.message || 'Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }, [currentSituationalReport, user])

  // Fetch LGU submission status for the current SitRep whenever entries view is active
  useEffect(() => {
    if (!isLGU || !currentSituationalReport?.id || !user?.city) {
      setLguSubmissionStatus(null)
      setLguSubmissionRemarks(null)
      return
    }
    let cancelled = false
    api.get('/lgu-submissions/status', {
      params: { situational_report_id: currentSituationalReport.id, city: user.city }
    }).then(({ data }) => {
      if (!cancelled) {
        setLguSubmissionStatus(data?.status || 'Draft')
        setLguSubmissionRemarks(data?.rejection_remarks || null)
      }
    }).catch(err => {
      console.error('[LGU] Failed to fetch submission status:', err)
    })
    return () => { cancelled = true }
  }, [isLGU, currentSituationalReport?.id, user?.city])

  const handleLguSubmit = async () => {
    if (!currentSituationalReport?.id || !user?.city) return
    showConfirm({
      title: 'Confirm Data Submission',
      message: `Submit your data for "${currentSituationalReport.title}"? This will make your data visible to Provincial and Regional users.`,
      onConfirm: async () => {
        setSubmittingLgu(true)
        try {
          await api.post('/lgu-submissions/submit', {
            situational_report_id: currentSituationalReport.id,
            city: user.city
          })
          setLguSubmissionStatus('Approved')
          setLguSubmissionRemarks(null)
          showSuccess('Success', `Your data for "${currentSituationalReport.title}" has been submitted and approved successfully.`)
        } catch (err) {
          console.error('[LGU] Submit error:', err)
          showToast('Error', err.response?.data?.error || err.message || 'Failed to submit data.', 'danger')
        } finally {
          setSubmittingLgu(false)
        }
      }
    })
  }

  const resetSitRepStatus = async () => {
    if (!currentSituationalReport) return
    
    if (['Approved', 'Pending Approval'].includes(currentSituationalReport.status) || currentSituationalReport.rejection_remarks) {
      try {
        const { data: updatedSR } = await api.patch(`/situational-reports/${currentSituationalReport.id}`, { 
          status: 'Draft', 
          pending_pdf_url: null,
          rejection_remarks: null 
        })
        
        setCurrentSituationalReport(prev => ({ 
          ...prev, 
          status: 'Draft', 
          pending_pdf_url: null,
          rejection_remarks: null
        }))
        
        if (selectedEvent) {
          fetchSituationalReports(selectedEvent.id)
        }
      } catch (err) {
        console.error('Error resetting report status:', err)
      }
    }
  }

  const deleteReport = async (item) => {
    console.log('[AddReport] Attempting to delete item:', item);
    try {
      await resetSitRepStatus()
      const table = item.tableName
      if (!table) {
        throw new Error('Table name missing for this item')
      }
      
      // Use single delete endpoint for individual items, it's more standard and avoids bulk payload issues
      await api.delete(`/reports/${table}/${item.id}`)
      
      showSuccess('Success', 'Report deleted successfully')
      fetchReports()
    } catch (err) {
      console.error('Delete error:', err)
      const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to delete report'
      showToast('Error', errorMsg, 'danger')
    }
  }

  const fetchFullSitRepData = async (sitRep) => {
    if (!sitRep) return null
    const eventId = selectedEvent?.id || sitRep.event_id
    console.log(`DEBUG: fetchFullSitRepData START for SitRep: ${sitRep.id}, Event: ${eventId}`)

    try {
      const { data } = await api.get('/reports/consolidated', {
        params: {
          event_id: eventId,
          situational_report_ids: sitRep.id,
          _t: Date.now() // Cache buster
        }
      })
      console.log('DEBUG: fetchFullSitRepData SUCCESS. Tables found:', Object.keys(data.details || {}))
      // Log sample data to see if it's changing
      if (data.details?.related_incidents?.length > 0) {
        console.log('DEBUG: First Related Incident ID:', data.details.related_incidents[0].id)
      }

      if (!data) return null

      const { summaryData, details } = data

      return {
        province: userProvince || sitRep.province || 'Region 1',
        eventName: selectedEvent?.name || 'SITUATIONAL REPORT',
        reportTitle: sitRep.title,
        cities: data.cities || [],
        categoryTotals: data.categoryTotals || {},
        byCityCategory: data.byCityCategory || {},
        relatedIncidentsDetails: details.relatedIncidents || [],
        affectedPopulationDetails: details.affectedPopulation || [],
        roadsAndBridgesDetails: details.roadsAndBridges || [],
        powerDetails: details.power || [],
        waterSupplyDetails: details.waterSupply || [],
        communicationLinesDetails: details.communicationLines || [],
        damagedHousesDetails: details.damagedHouses || [],
        classSuspensionDetails: details.classSuspension || [],
        workSuspensionDetails: details.workSuspension || [],
        stateOfCalamityDetails: details.stateOfCalamity || [],
        preEmptiveEvacuationDetails: details.preEmptiveEvacuation || [],
        assistanceProvidedDetails: details.assistanceProvided || [],
        assistanceLgusDetails: details.assistanceLgusAgencies || [],
        agricultureDamageDetails: details.agricultureDamage || [],
        infrastructureDamageDetails: details.infrastructureDamage || [],
        summaryData
      }
    } catch (err) {
      console.error('Error fetching full SitRep data:', err)
      return null
    }
  }

  const fetchSignatories = async () => {
    setLoadingSignatories(true)
    try {
      const params = { status: 'Active' }
      if (!isSuperAdmin && !isRegional && userProvince) {
        params.province = userProvince
      }
      const { data } = await api.get('/users', { params })
      if (data) {
        const mapped = data.map(u => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          account_type: u.account_type,
          province: u.province,
          designation: u.account_type,
          office: u.province || 'PDRRMO'
        }))
        setAvailableSignatories(mapped)
        
        if (preparedBy.length === 0) {
          const provincialUsers = mapped.filter(u => u.account_type === 'Provincial')
          const approverUsers = mapped.filter(u => u.account_type === 'Provincial Approver')
          if (provincialUsers.length > 0) {
            setPreparedBy(provincialUsers.slice(0, 1))
            if (provincialUsers.length > 1) setNotedBy(provincialUsers[1])
          }
          if (approverUsers.length > 0) setApprovedBy(approverUsers[0])
        }
      }
    } catch (err) {
      console.error('Error fetching signatories:', err)
    } finally {
      setLoadingSignatories(false)
    }
  }

  const toggleSignatory = (sig) => {
    if (signatoryRole === 'preparedBy') {
      const isSelected = preparedBy.some(s => s.id === sig.id)
      setPreparedBy(prev => isSelected ? prev.filter(p => p.id !== sig.id) : [...prev, sig])
    } else if (signatoryRole === 'notedBy') {
      setNotedBy(prev => prev?.id === sig.id ? null : sig)
    } else if (signatoryRole === 'approvedBy') {
      setApprovedBy(prev => prev?.id === sig.id ? null : sig)
    }
  }

  const handleSignatoryRoleChange = (role) => {
    setSignatoryRole(role)
    setSignatorySearch('')
  }

  useEffect(() => {
    fetchSignatories()
  }, [])

  const generatePdfBlobUrl = (pdfParams, summaryOverride, sigs) => {
    console.log('DEBUG: generatePdfBlobUrl called for reportTitle:', pdfParams?.reportTitle)
    try {
      const doc = generateRelatedIncidentsPdf({
        ...pdfParams,
        summaryText: summaryOverride,
        signatories: sigs || { preparedBy: [], notedBy: null, approvedBy: null }
      })
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      console.log('DEBUG: New Blob URL created:', url)
      return url
    } catch (e) {
      console.error('PDF preview error', e)
      return null
    }
  }

  const handleReportDownload = async (sr) => {
    if (!sr) return
    
    // If a signed PDF is already uploaded and approved, give options
    if (sr.approved_pdf_url && sr.status === 'Approved') {
      showConfirm({
        title: 'Download Report',
        message: 'An approved signed PDF is already available. Would you like to download the official signed PDF or generate a new consolidated ZIP?',
        confirmText: 'Download Official PDF',
        cancelText: 'Generate Consolidated ZIP',
        type: 'info',
        onConfirm: () => {
          const link = document.createElement('a')
          link.href = sr.approved_pdf_url
          link.setAttribute('download', `Approved_Report_${sr.report_number || sr.id}.pdf`)
          link.setAttribute('target', '_blank')
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        },
        onCancel: () => {
          processConsolidatedExport(sr)
        }
      })
    } else {
      // For non-approved, ask if they want PDF (old flow) or CSV (new flow)
      showConfirm({
        title: 'Download Report',
        message: 'How would you like to export this situational report?',
        confirmText: 'Consolidated ZIP (CSVs)',
        cancelText: 'Generate PDF Report',
        type: 'info',
        onConfirm: () => {
          processConsolidatedExport(sr)
        },
        onCancel: () => {
          startReportGeneration(sr)
        }
      })
    }
  }

  const processConsolidatedExport = async (sr) => {
    try {
      setProcessingExportId(sr.id)
      const { data: allData } = await api.get('/reports/all-types', {
        params: { situational_report_id: sr.id }
      })

      const exportData = {
        eventName: selectedEvent?.name || 'Event',
        summaryText: sr.title || '',
        relatedIncidentsDetails: allData.filter(d => d.category === 'incidents'),
        affectedPopulationDetails: allData.filter(d => d.category === 'evacuation'),
        roadsAndBridgesDetails: allData.filter(d => d.category === 'roads'),
        powerDetails: allData.filter(d => d.category === 'power'),
        waterSupplyDetails: allData.filter(d => d.category === 'water'),
        communicationLinesDetails: allData.filter(d => d.category === 'communication'),
        damagedHousesDetails: allData.filter(d => d.category === 'houses'),
        classSuspensionDetails: allData.filter(d => d.category === 'class'),
        workSuspensionDetails: allData.filter(d => d.category === 'work'),
        stateOfCalamityDetails: allData.filter(d => d.category === 'calamity'),
        preEmptiveEvacuationDetails: allData.filter(d => d.category === 'preemptive'),
        assistanceProvidedDetails: allData.filter(d => d.category === 'assistance'),
        assistanceLgusDetails: allData.filter(d => d.category === 'assistance_lgus'),
        agricultureDamageDetails: allData.filter(d => d.category === 'agriculture'),
        infrastructureDamageDetails: allData.filter(d => d.category === 'infrastructure'),
      }

      generateConsolidatedCsv(exportData)
      showToast('Export Success', 'Consolidated report generated successfully.', 'success')
    } catch (err) {
      console.error('Export failed:', err)
      showToast('Export Error', 'Failed to generate export: ' + err.message, 'danger')
    } finally {
      setProcessingExportId(null)
    }
  }

  const startReportGeneration = async (sr) => {
    console.log('DEBUG: startReportGeneration called for sr.id:', sr?.id)
    setProcessingExportId(sr?.id)
    
    // Fix Race Condition & Stuck Preview: Clear states IMMEDIATELY
    setPdfPreviewBlobUrl(null)
    setGeneratedSummaryData(null)
    setAiGeneratedSummaryText('')
    setSummaryHistory([])
    setSelectedHistoryId('current')
    currentGeneratingSitRepId.current = sr.id

    try {
      const eventToUse = selectedEvent || events?.find(e => e.id === sr.event_id)
      const data = await fetchFullSitRepData(sr)
      
      if (currentGeneratingSitRepId.current !== sr.id) return

      if (data) {
        setGeneratedSummaryData({ pdfParams: data, event: eventToUse, situationalReportId: sr.id })
        
        // Fetch history first
        const history = await fetchSummaryHistory(sr.id)
        
        let initialText = ''
        if (history.length > 0) {
          // Use latest from history
          initialText = history[0].summary_text
          setAiGeneratedSummaryText(initialText)
          setSelectedHistoryId(history[0].id)
        } else if (sr.summary) {
          // Legacy/fallback: use current column and save it as first history entry
          initialText = sr.summary
          setAiGeneratedSummaryText(initialText)
          await saveSummaryToHistory(initialText)
        } else {
          // No history and no current summary: generate first one
          const summaryPlaceholder = 'Generating AI Summary... Please wait.'
          setAiGeneratedSummaryText(summaryPlaceholder)
          
          const blobUrl = generatePdfBlobUrl(data, summaryPlaceholder, { preparedBy: [], notedBy: null, approvedBy: null })
          setPdfPreviewBlobUrl(blobUrl)

          const summaryPayload = data.summaryData || { 
            categoryTotals: data.categoryTotals || {}, 
            byCityCategory: data.byCityCategory || {}, 
            details: data 
          }
          
          try {
            const text = await generateAISummary(summaryPayload, eventToUse, data.relatedIncidentsDetails || [])
            if (currentGeneratingSitRepId.current === sr.id) {
              setAiGeneratedSummaryText(text)
              // Auto-save the first generation
              await api.post(`/situational-reports/${sr.id}/summaries`, { summary_text: text })
              await fetchSummaryHistory(sr.id)
              initialText = text
            }
          } catch (err) {
            console.error('Initial generation failed:', err)
            setAiGeneratedSummaryText('AI summary unavailable. Using rule-based fallback.')
          }
        }

        if (initialText) {
          const blobUrl = generatePdfBlobUrl(data, initialText, { 
            preparedBy: preparedByRef.current, 
            notedBy: notedByRef.current, 
            approvedBy: approvedByRef.current 
          })
          setPdfPreviewBlobUrl(blobUrl)
        }

        fetchSignatories()
        setShowPdfEditModal(true)
      }
    } catch (err) {
      console.error('CRITICAL ERROR in startReportGeneration:', err)
      setError('An error occurred while preparing the report data.')
    } finally {
      if (currentGeneratingSitRepId.current === sr.id) {
        setProcessingExportId(null)
      }
    }
  }

  const fetchSummaryHistory = async (sitRepId) => {
    try {
      const { data } = await api.get(`/situational-reports/${sitRepId}/summaries`)
      setSummaryHistory(data || [])
      return data || []
    } catch (err) {
      console.error('Failed to fetch summary history:', err)
      return []
    }
  }

  const saveSummaryToHistory = async (text) => {
    if (!generatedSummaryData?.situationalReportId || !text) return
    setIsSavingSummary(true)
    try {
      const { data } = await api.post(`/situational-reports/${generatedSummaryData.situationalReportId}/summaries`, {
        summary_text: text
      })
      await fetchSummaryHistory(generatedSummaryData.situationalReportId)
      setSelectedHistoryId(data.id)
      showToast('Saved', 'Summary version saved successfully.', 'success')
    } catch (err) {
      showToast('Error', 'Failed to save summary version.', 'danger')
    } finally {
      setIsSavingSummary(false)
    }
  }

  const handleRegenerateAISummary = async () => {
    if (!generatedSummaryData) return
    const { pdfParams, event, situationalReportId } = generatedSummaryData
    
    setPdfPreviewBlobUrl(null)
    setAiGeneratedSummaryText('Regenerating AI Summary... Please wait.')
    setShowRegenerateConfirm(false)

    try {
      const summaryPayload = pdfParams.summaryData || { 
        categoryTotals: pdfParams.categoryTotals || {}, 
        byCityCategory: pdfParams.byCityCategory || {}, 
        details: pdfParams 
      }
      
      const newText = await generateAISummary(summaryPayload, event, pdfParams.relatedIncidentsDetails || [])
      setAiGeneratedSummaryText(newText)
      
      // Auto-save the regenerated summary
      await api.post(`/situational-reports/${situationalReportId}/summaries`, {
        summary_text: newText
      })
      await fetchSummaryHistory(situationalReportId)
      setSelectedHistoryId('current') // Latest will be current in the map logic
      
      showToast('Regenerated', 'New AI summary generated and saved.', 'success')
    } catch (err) {
      console.error('Regeneration failed:', err)
      showToast('Error', 'Failed to regenerate summary.', 'danger')
      setAiGeneratedSummaryText('Failed to regenerate summary. Please try again or use existing versions.')
    }
  }

  const handleConfirmDownload = () => {
    if (!generatedSummaryData) return
    const finalDoc = generateRelatedIncidentsPdf({
      ...generatedSummaryData.pdfParams,
      summaryText: aiGeneratedSummaryText,
      signatories: { preparedBy, notedBy, approvedBy }
    })
    finalDoc.save(`${generatedSummaryData.pdfParams.reportTitle.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`)
    setShowPdfEditModal(false)
    setShowSignatoriesModal(false)
  }

  const handleConfirmCsvDownload = () => {
    if (!generatedSummaryData) return
    generateConsolidatedCsv({
      ...generatedSummaryData.pdfParams,
      signatories: { preparedBy, notedBy, approvedBy }
    })
    setShowSignatoriesModal(false)
  }

  useEffect(() => {
    if (selectedEvent?.id) {
      fetchSituationalReports(selectedEvent.id)
    }
  }, [selectedEvent?.id, fetchSituationalReports])

useEffect(() => {
  if (view === 'entries') {
    fetchReports()
  }
}, [fetchReports, view])

  useEffect(() => {
    if (!showPdfEditModal || !generatedSummaryData) return
    
    const timeout = setTimeout(() => {
      console.log('DEBUG: Debounced update triggering for PDF preview...')
      const newUrl = generatePdfBlobUrl(
        generatedSummaryData.pdfParams, 
        aiGeneratedSummaryText, 
        { preparedBy, notedBy, approvedBy }
      )
      if (newUrl) {
        setPdfPreviewBlobUrl(newUrl)
      }
    }, 800) // 800ms debounce

    return () => clearTimeout(timeout)
  }, [aiGeneratedSummaryText, preparedBy, notedBy, approvedBy, showPdfEditModal, generatedSummaryData])

  useEffect(() => {
    if (showSignatoriesModal) fetchSignatories()
  }, [showSignatoriesModal])

  const handleUploadPdfClick = (sitRep) => {
    setCurrentSituationalReport(sitRep)
    setApprovalFile(null)
    setApprovalConfirmMessage('')
    setShowApprovalUploadModal(true)
  }

  const handleUploadPdfSubmit = async () => {
    if (!approvalFile || !currentSituationalReport) return
    if (approvalFile.type !== 'application/pdf') {
      showToast('Validation Error', 'Only PDF files are allowed.', 'warning')
      return
    }
    setUploadingApproval(true)
    try {
      const formData = new FormData()
      formData.append('file', approvalFile)
      formData.append('category', 'approvals')

      const { data: uploadData } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const pdfUrl = uploadData.url
      const newStatus = isLGU ? 'Pending Provincial Review' : 'Approved'

      await api.patch(`/situational-reports/${currentSituationalReport.id}`, { 
        status: newStatus, 
        approved_pdf_url: !isLGU ? pdfUrl : null,
        pending_pdf_url: isLGU ? pdfUrl : null,
        rejection_remarks: null
      })

      if (selectedEvent) fetchSituationalReports(selectedEvent.id)

      // Notify relevant users
      try {
        if (isLGU) {
          // Notify Provincial users in the same province
          const { data: provincialUsers } = await api.get('/users', {
            params: { province: userProvince, account_type: 'Provincial', status: 'Active' }
          })
          const targetUsers = (provincialUsers || []).filter(u => u.id !== user?.id)
          if (targetUsers.length > 0) {
            const notifications = targetUsers.map(u => ({
              user_id: u.id,
              type: 'lgu_sitrep_submission',
              title: 'New LGU SitRep for Review',
              message: `LGU ${user?.city} has submitted a situational report "${currentSituationalReport.title}" for your review.`,
              data: { sitrep_id: currentSituationalReport.id, event_id: selectedEvent?.id }
            }))
            await api.post('/notifications/bulk', notifications)
          }
        } else {
          // Provincial/Admin flow: Notify Super Admins/Regional that a new approved report is available
          const { data: admins } = await api.get('/users', {
            params: { 
              account_type: ['Super Admin', 'Regional Admin', 'Regional'],
              status: 'Active'
            }
          })
          
          const targetUsers = (admins || []).filter(u => u.id !== user?.id)

          if (targetUsers.length > 0) {
            const notifications = targetUsers.map(u => ({
              user_id: u.id,
              type: 'sitrep_approved',
              title: 'New Approved SitRep',
              message: `A new approved situational report "${currentSituationalReport.title}" has been uploaded by ${user?.province || 'Province'}.`,
              data: { sitrep_id: currentSituationalReport.id, event_id: selectedEvent?.id }
            }))
            await api.post('/notifications/bulk', notifications)
          }
        }
      } catch (notifErr) {
        console.error('Failed to send submission notifications:', notifErr)
      }

      if (currentSituationalReport?.id) {
        await markSitRepNotificationsAsRead(currentSituationalReport.id)
      }

      setShowApprovalUploadModal(false)
      const successMsg = isLGU 
        ? 'The signed PDF has been uploaded and submitted to the Province for review.'
        : 'The signed PDF has been uploaded and the report is now marked as Approved and visible to Regional users.'
      setApprovalConfirmMessage(successMsg)
      setShowApprovalConfirmation(true)
    } catch (err) {
      showToast('Error', err.message || 'Failed to upload PDF.', 'danger')
    } finally {
      setUploadingApproval(false)
    }
  }


  const handleApproveSitRep = async (sitRep) => {
    showConfirm({
      title: 'Approve Situational Report',
      message: `Are you sure you want to approve "${sitRep.title}"? This will mark it as Approved and make it visible to Regional users.`,
      confirmText: 'Approve',
      cancelText: 'Cancel',
      type: 'success',
      onConfirm: async () => {
        try {
          await api.patch(`/situational-reports/${sitRep.id}`, { 
            status: 'Approved',
            rejection_remarks: null,
            approved_pdf_url: sitRep.pending_pdf_url || sitRep.approved_pdf_url,
            pending_pdf_url: null
          })
          showSuccess('Approved', `"${sitRep.title}" has been approved successfully.`)
          await markSitRepNotificationsAsRead(sitRep.id)
          if (selectedEvent) fetchSituationalReports(selectedEvent.id)
        } catch (err) {
          showToast('Error', err.message || 'Failed to approve report.', 'danger')
        }
      }
    })
  }

  const handleOpenReviewModal = (sitRep) => {
    setReviewSitRep(sitRep)
    setRejectRemarks('')
    setShowRejectInput(false)
    setShowReviewModal(true)
  }

  const handleApproveConfirm = async () => {
    if (!reviewSitRep) return
    setProcessingReview(true)
    try {
      await api.patch(`/situational-reports/${reviewSitRep.id}`, { 
        status: 'Approved', 
        rejection_remarks: null,
        approved_pdf_url: reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url,
        pending_pdf_url: null
      })

      // Notify the creator (LGU or Provincial)
      try {
        if (reviewSitRep.created_by) {
          const { data: creator } = await api.get(`/users/${reviewSitRep.created_by}`).catch(() => ({ data: null }))
          if (creator) {
            const notifData = {
              user_id: creator.id,
              type: 'sitrep_approval',
              title: 'Situational Report Approved',
              message: `Your report "${reviewSitRep.title}" has been approved by the Province.`,
              data: { sitrep_id: reviewSitRep.id, event_id: selectedEvent?.id }
            }
            await api.post('/notifications', notifData)
          }
        }
      } catch (notifErr) {
        console.error('Failed to send approval notification to creator:', notifErr)
      }

      showSuccess('Approved', `"${reviewSitRep.title}" has been approved successfully.`)
      setShowReviewModal(false)
      await markSitRepNotificationsAsRead(reviewSitRep.id)
      if (selectedEvent) fetchSituationalReports(selectedEvent.id)
    } catch (err) {
      showToast('Error', err.message || 'Failed to approve report.', 'danger')
    } finally {
      setProcessingReview(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!reviewSitRep || !rejectRemarks.trim()) {
      showToast('Required', 'Please enter remarks before rejecting.', 'warning')
      return
    }
    setProcessingReview(true)
    try {
      await api.patch(`/situational-reports/${reviewSitRep.id}`, { 
        status: 'Draft', 
        rejection_remarks: rejectRemarks.trim() 
      })

      // Notify the creator (LGU or Provincial)
      try {
        if (reviewSitRep.created_by) {
          const { data: creator } = await api.get(`/users/${reviewSitRep.created_by}`).catch(() => ({ data: null }))
          if (creator) {
            const notifData = {
              user_id: creator.id,
              type: 'sitrep_rejection',
              title: 'Situational Report Rejected',
              message: `Your report "${reviewSitRep.title}" was rejected by the Province. Remarks: ${rejectRemarks.trim()}`,
              data: { sitrep_id: reviewSitRep.id, event_id: selectedEvent?.id, remarks: rejectRemarks.trim() }
            }
            await api.post('/notifications', notifData)
          }
        }
      } catch (notifErr) {
        console.error('Failed to send rejection notification to creator:', notifErr)
      }

      showSuccess('Rejected', `"${reviewSitRep.title}" has been rejected. The creator has been notified.`)
      setShowReviewModal(false)
      await markSitRepNotificationsAsRead(reviewSitRep.id)
      if (selectedEvent) fetchSituationalReports(selectedEvent.id)
    } catch (err) {
      showToast('Error', err.message || 'Failed to reject report.', 'danger')
    } finally {
      setProcessingReview(false)
    }
  }

  const exportCSV = () => {
    if (!submittedReports.length) return
    const headers = ['Category', 'Location', 'Classification', 'Summary/Details', 'Status', 'Remarks', 'Timestamp']
    const csvContent = [
      headers.join(','),
      ...submittedReports.map(r => [
        `"${r.categoryLabel}"`,
        `"${r.location}"`,
        `"${r.classification}"`,
        `"${(r.summary || '').replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
        `"${new Date(r.timestamp).toLocaleString()}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Reports_${selectedEvent?.name}_${new Date().toISOString()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredEvents = useMemo(() => {
    if (view !== 'events') return []
    if (!searchTerm) return events
    const low = searchTerm.toLowerCase()
    return events.filter(e =>
      e.name?.toLowerCase().includes(low) ||
      e.eventType?.toLowerCase().includes(low)
    )
  }, [events, searchTerm, view])

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents]
    list.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
    return list
  }, [filteredEvents])

  const totalEventPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize))
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedEvents.slice(start, start + pageSize)
  }, [sortedEvents, currentPage, pageSize])

  const filteredRows = useMemo(() => {
    let result = submittedReports
    if (!searchTerm) return result
    
    const low = searchTerm.toLowerCase()
    return result.filter(r => 
      r.location?.toLowerCase().includes(low) ||
      r.categoryLabel?.toLowerCase().includes(low) ||
      r.classification?.toLowerCase().includes(low) ||
      r.summary?.toLowerCase().includes(low) ||
      r.status?.toLowerCase().includes(low) ||
      r.remarks?.toLowerCase().includes(low)
    )
  }, [submittedReports, searchTerm])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]
    list.sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]
      if (sortKey === 'timestamp') {
        va = new Date(va || 0).getTime()
        vb = new Date(vb || 0).getTime()
      }
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [filteredRows, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, currentPage, pageSize])

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortIcon = ({ columnKey }) => {
    if (sortKey !== columnKey) return <CaretDown size={14} className="add-report-sort-icon inactive" />
    return sortAsc ? <CaretUp size={14} className="add-report-sort-icon" /> : <CaretDown size={14} className="add-report-sort-icon" />
  }

  const handleRowChange = (rowIndex, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row
        const updated = { ...row, [field]: value }

        // Auto-compute totals
        if (activeCategoryModal === 'houses') {
          updated.grandTotal = (parseInt(updated.totallyDamaged) || 0) + (parseInt(updated.partiallyDamaged) || 0)
        }
        if (activeCategoryModal === 'preemptive') {
          updated.total = (parseInt(updated.maleCount) || 0) + (parseInt(updated.femaleCount) || 0)
        }
        if (activeCategoryModal === 'assistance') {
          const requiring = parseInt(updated.noFamiliesRequiringAssistance) || 0
          const assisted = parseInt(updated.noFamiliesAssisted) || 0
          updated.pctFamiliesAssisted = requiring > 0 ? Math.min(100, Math.round((assisted / requiring) * 10000) / 100) : 0
        }

        return updated
      })
    )
  }

  const handleDateTimeChange = (rowIndex, dateField, timeField, value) => {
    // value is in format YYYY-MM-DDTHH:mm
    if (!value) {
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex ? { ...row, [dateField]: '', [timeField]: '' } : row
        )
      )
      return
    }
    const [date, time] = value.split('T')
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex ? { ...row, [dateField]: date || '', [timeField]: time || '' } : row
      )
    )
  }

  const handleSiteCoverageChange = (rowIndex, tech, value) => {
    // value is Operational/Total format e.g. "10/12" or "10 / 12"
    const parts = value.split('/')
    const op = parts[0] ? parts[0].trim() : ''
    const tot = parts[1] ? parts[1].trim() : ''

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row
        const operational = parseInt(op) || 0
        const total = parseInt(tot) || 0
        const pct = total > 0 ? Math.round((operational / total) * 100) : 0
        return {
          ...row,
          [`withCoverage${tech}`]: op,
          [`siteCount${tech}`]: tot,
          [`pctCoverage${tech}`]: pct,
          [`displayCoverage${tech}`]: value // Store the raw string for editing
        }
      })
    )
  }

  const openTextEditorModal = (index, field, value, title) => {
    setTextEditorModalData({ rowIndex: index, field, value, tempValue: value || '', title: title || 'Edit Text' })
    setShowTextEditorModal(true)
  }

  const saveTextUpdate = () => {
    showConfirm({
      title: 'Save Changes',
      message: 'Are you sure you want to save these text changes?',
      onConfirm: () => {
        if (textEditorModalData) {
          handleRowChange(textEditorModalData.rowIndex, textEditorModalData.field, textEditorModalData.tempValue)
        }
        setShowTextEditorModal(false)
        setTextEditorModalData(null)
      }
    })
  }

  const addRow = () => {
    const defaultRowCity = isLGU ? user.city : defaultCity
    setRows((prev) => [...prev, emptyRow(activeCategoryModal, defaultRowCity)])
  }

  const removeRow = (index) => {
    const rowToRemove = rows[index]
    if (rows.length > 1) {
      showConfirm({
        title: 'Remove Row',
        message: 'Are you sure you want to remove this row? This change will be applied when you submit the report.',
        onConfirm: () => {
          if (rowToRemove.id) {
            setDeletedRowIds(prev => [...prev, rowToRemove.id])
          }
          setRows((prev) => prev.filter((_, i) => i !== index))
        }
      })
    }
  }

  const openModal = () => {
    setShowCategoryModal(true)
  }

  const handleCategorySelect = (catId) => {
    setShowCategoryModal(false)
    const existingEntry = submittedReports.find(r => r.category === catId)
    if (existingEntry) {
      handleEditReport(existingEntry)
      return
    }

    setActiveCategoryModal(catId)
    const defaultRowCity = isLGU ? user?.city : defaultCity
    setRows([emptyRow(catId, defaultRowCity)])
    setEditingItemId(null)
    setDeletedRowIds([])
  }

  const handleCreateSitRep = async () => {
    if (!newSitRepTitle.trim()) {
      showToast('Validation Error', 'Please enter a title for the situational report.', 'warning')
      return
    }

    showConfirm({
      title: 'Create Situational Report',
      message: `Are you sure you want to create "${newSitRepTitle.trim()}"?`,
      onConfirm: async () => {
        try {
          setSubmitting(true)

          // Determine if we should copy from the most recent SitRep
          console.log('[AddReport] situationalReports list:', situationalReports);
          
          // Sort by report_number DESC, then by created_at DESC as fallback
          const sortedSitReps = [...situationalReports].sort((a, b) => {
            const numA = parseInt(a.report_number) || 0;
            const numB = parseInt(b.report_number) || 0;
            if (numB !== numA) return numB - numA;
            return new Date(b.created_at) - new Date(a.created_at);
          });
          
          const previousSitRep = sortedSitReps[0]
          console.log('[AddReport] previousSitRep found for cloning:', previousSitRep);
          
          const copyFromId = shouldInheritData && previousSitRep ? previousSitRep.id : undefined
          console.log('[AddReport] shouldInheritData:', shouldInheritData);
          console.log('[AddReport] final copyFromId to send:', copyFromId);

          const newSR = await createSituationalReport(selectedEvent.id, newSitRepTitle.trim(), {
            pingedReportTypes: pingedCategories,
            targetLgus: targetLgus,
            province: selectedProvinces.length === 1 ? selectedProvinces[0] : (selectedProvinces.length > 1 ? 'Region 1' : userProvince),
            copyFromId,
            skip_auto_clone: !shouldInheritData
          })
          if (newSR) {
            console.log('[AddReport] SitRep created successfully:', newSR);
            const clonedMsg = newSR.autoCloned || newSR.cloned_from_id 
              ? ' with data automatically cloned from the previous report.' 
              : '.';
            showSuccess('Report Created', `Successfully created ${newSR.title}${clonedMsg}`)
            
            setCurrentSituationalReport(newSR)
            setShowNewSitRepModal(false)
            setNewSitRepTitle('')
            setPingedCategories([])
            setShouldInheritData(true)
            setView('entries')
          } else {
            showSuccess('Error', 'Failed to create Situation Report.')
          }
        } catch (err) {
          console.error('Error in handleCreateSitRep:', err)
          showToast('Error', err?.message || 'An unexpected error occurred.', 'danger')
        } finally {
          setSubmitting(false)
        }
      }
    })
  }

  const handleOpenEditSitRepModal = (sr) => {
    setEditingSitRep(sr)
    setNewSitRepTitle(sr.title)
    setTargetLgus(Array.isArray(sr.target_lgus) ? sr.target_lgus : [])
    setShowEditSitRepModal(true)
  }

  const handleUpdateSitRep = async () => {
    if (!newSitRepTitle.trim()) {
      showToast('Validation Error', 'Please enter a title for the situational report.', 'warning')
      return
    }

    showConfirm({
      title: 'Update Situational Report',
      message: `Are you sure you want to update this situational report to "${newSitRepTitle.trim()}"?`,
      onConfirm: async () => {
        try {
          setSubmitting(true)
          const updatedSR = await updateSituationalReport(editingSitRep.id, {
            title: newSitRepTitle.trim(),
            targetLgus: targetLgus
          })
          
          if (updatedSR) {
            setShowEditSitRepModal(false)
            setEditingSitRep(null)
            setNewSitRepTitle('')
            setTargetLgus([])
            showSuccess('Success', 'Situational report updated successfully.')
          }
        } catch (err) {
          console.error('Error in handleUpdateSitRep:', err)
          showToast('Error', err?.message || 'An unexpected error occurred.', 'danger')
        } finally {
          setSubmitting(false)
        }
      }
    })
  }



  const handleCloseActiveModal = () => {
    setActiveCategoryModal(null)
    setRows([emptyRow()])
    setUnifiedForm({})
    setEditingItemId(null)
  }

  const handleEditReport = (item) => {
    setActiveCategoryModal(item.category)
    setDeletedRowIds([])
    // For evacuation, the "editingItemId" should be the parent report_id
    setEditingItemId(item.category === 'evacuation' ? item.report_id : item.id)
    if (item.all_rows) {
      setRows(item.all_rows.map(r => dbRowToApp(r, item.category)))
    } else {
      setRows([dbRowToApp(item, item.category)])
    }
  }

  const handleUnifiedChange = (field, value) => {
    setUnifiedForm(prev => {
      const updated = { ...prev, [field]: value }
      if (activeCategoryModal === 'houses') {
        updated.grandTotal = (parseInt(updated.totallyDamaged) || 0) + (parseInt(updated.partiallyDamaged) || 0)
      }
      if (activeCategoryModal === 'preemptive') {
        updated.total = (parseInt(updated.maleCount) || 0) + (parseInt(updated.femaleCount) || 0)
      }
      if (activeCategoryModal === 'assistance') {
        const requiring = parseInt(updated.noFamiliesRequiringAssistance) || 0
        const assisted = parseInt(updated.noFamiliesAssisted) || 0
        updated.pctFamiliesAssisted = requiring > 0 ? Math.min(100, Math.round((assisted / requiring) * 10000) / 100) : 0
      }
      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const categoryTitle = REPORT_CATEGORIES.find(c => c.id === activeCategoryModal)?.title || 'Report'
    
    showConfirm({
      title: 'Submit Report',
      message: `Are you sure you want to submit this ${categoryTitle}?`,
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await resetSitRepStatus()
          
          // Categories that require barangay (for LGU users) vs can be submitted at city level
          const categoriesRequiringBarangay = ['evacuation', 'incidents', 'houses', 'class', 'work', 'calamity', 'preemptive', 'assistance']
          const validRows = rows.filter((r) => {
            if (categoriesRequiringBarangay.includes(activeCategoryModal)) {
              return r.barangay && r.barangay.trim() !== ''
            }
            return true
          })

          if (validRows.length === 0) {
            showSuccess('Validation Error', 'Please ensure all entries have a barangay selected.')
            setSubmitting(false)
            return
          }
          const table = CATEGORY_TO_TABLE[activeCategoryModal]
          let reportId = null
          
          // 1. Handle Deletions
          if (deletedRowIds.length > 0) {
            const deleteTable = activeCategoryModal === 'evacuation' ? 'report_rows' : table
            await api.delete(`/reports/${deleteTable}/bulk`, { data: { ids: deletedRowIds } })
          }

          if (activeCategoryModal === 'evacuation') {
            reportId = editingItemId
            if (!reportId) {
              const { data: reportData } = await api.post('/reports/reports', {
                event_id: selectedEvent?.id,
                situational_report_id: currentSituationalReport.id
              })
              console.log('DEBUG: Created new report:', reportData)
              reportId = reportData.id
            }

            if (!reportId) {
              throw new Error('Failed to create or identify the parent report. Please try again.')
            }

            const toInsert = validRows.filter(r => !r.id).map(r => ({ 
              ...rowToDb(r), 
              report_id: reportId,
              city: r.city || user?.city || defaultCity 
            }))
            const toUpdate = validRows.filter(r => r.id).map(r => ({ 
              ...rowToDb(r), 
              report_id: reportId, 
              id: r.id,
              city: r.city || user?.city || defaultCity
            }))

            console.log('DEBUG: Submitting evacuation data:', { reportId, toInsert, toUpdate })

            if (toInsert.length > 0) await api.post('/reports/report_rows/bulk', toInsert)
            if (toUpdate.length > 0) await api.patch('/reports/report_rows/bulk', toUpdate)

          } else {
            const preparePayload = (row) => {
              const cityValue = row.city || user?.city || defaultCity
              const base = {
                event_id: selectedEvent?.id,
                situational_report_id: currentSituationalReport.id,
                city: cityValue,
                barangay: row.barangay,
                remarks: row.remarks || ''
              }
              switch (activeCategoryModal) {
                case 'power':
                case 'water':
                  return {
                    ...base,
                    type: row.type || 'Other',
                    service_provider: row.serviceProvider || 'N/A',
                    date_of_interruption: row.dateInterruption || '1970-01-01',
                    time_of_interruption: row.timeInterruption || null,
                    date_restored: row.dateRestored || null,
                    time_restored: row.timeRestored || null,
                    status: row.status || 'Ongoing'
                  }
                case 'roads':
                  return {
                    ...base,
                    classification: row.classification,
                    road_bridge_name: row.roadBridgeName,
                    status: row.status,
                    date_reported_passable: row.datePassable || null,
                    time_reported_passable: row.timePassable || null,
                    date_reported_not_passable: row.dateNotPassable || null,
                    time_reported_not_passable: row.timeNotPassable || null
                  }
                case 'communication':
                  return {
                    ...base,
                    telecompany: row.telecompany || '',
                    status_of_communication: row.statusOfCommunication || '',
                    date_interruption: row.dateInterruption || null,
                    time_interruption: row.timeInterruption || null,
                    date_restoration: row.dateRestoration || null,
                    time_restoration: row.timeRestoration || null,
                    site_count_2g: parseInt(row.siteCount2g) || null,
                    with_coverage_2g: parseInt(row.withCoverage2g) || null,
                    pct_coverage_2g: parseFloat(row.pctCoverage2g) || null,
                    site_count_3g: parseInt(row.siteCount3g) || null,
                    with_coverage_3g: parseInt(row.withCoverage3g) || null,
                    pct_coverage_3g: parseFloat(row.pctCoverage3g) || null,
                    site_count_4g: parseInt(row.siteCount4g) || null,
                    with_coverage_4g: parseInt(row.withCoverage4g) || null,
                    pct_coverage_4g: parseFloat(row.pctCoverage4g) || null,
                    status: row.status || 'Operational'
                  }
                case 'incidents':
                  return {
                    ...base,
                    type_of_incident: row.typeOfIncident || 'Other',
                    date_of_occurrence: row.dateOfOccurrence || '1970-01-01',
                    time_of_occurrence: row.timeOfOccurrence || null,
                    description: row.description || '',
                    actions_taken: row.actionsTaken || '',
                    status: row.status || 'Ongoing'
                  }
                case 'houses':
                  return {
                    ...base,
                    totally_damaged: parseInt(row.totallyDamaged) || 0,
                    partially_damaged: parseInt(row.partiallyDamaged) || 0,
                    grand_total: parseInt(row.grandTotal) || 0,
                    amount_php: parseFloat(row.amountPhp) || 0,
                    status: row.status || 'Reported'
                  }
                case 'class':
                  return {
                    ...base,
                    level_from: row.level || '',
                    type: row.typeOfSuspension || '',
                    date_of_suspension: row.dateOfSuspension || null,
                    time_of_suspension: row.timeOfSuspension || null,
                    date_resumed: row.dateOfResumption || null,
                    time_resumed: row.timeOfResumption || null,
                    status: row.status || 'Ongoing'
                  }
                case 'work':
                  return {
                    ...base,
                    type: row.typeOfSuspension || '',
                    date_of_suspension: row.dateOfSuspension || null,
                    time_of_suspension: row.timeOfSuspension || null,
                    date_resumed: row.dateOfResumption || null,
                    time_resumed: row.timeOfResumption || null,
                    status: row.status || 'Ongoing'
                  }
                case 'calamity':
                  return {
                    ...base,
                    type: row.type || '',
                    count_soc: parseInt(row.countSoc) || null,
                    resolution_number: row.resolutionNo || '',
                    resolution_date: row.resolutionDate || null,
                    status: row.status || 'Declared'
                  }
                case 'preemptive':
                  return {
                    ...base,
                    families: parseInt(row.families) || 0,
                    male_count: parseInt(row.maleCount) || 0,
                    female_count: parseInt(row.femaleCount) || 0,
                    total: parseInt(row.total) || 0,
                    status: row.status || 'Completed'
                  }
                case 'assistance':
                  return {
                    ...base,
                    no_families_affected: parseInt(row.familiesAffected) || 0,
                    needs: row.needs || '',
                    no_families_requiring_assistance: parseInt(row.familiesRequiring) || 0,
                    fnfi_qty: parseFloat(row.fnfiQty) || null,
                    fnfi_unit: row.fnfiUnit || '',
                    fnfi_cost_per_unit: parseFloat(row.fnfiCostPerUnit) || null,
                    fnfi_amount: parseFloat(row.fnfiAmount) || 0,
                    fnfi_source: row.fnfiSource || '',
                    no_families_assisted: parseInt(row.familiesAssisted) || 0,
                    pct_families_assisted: parseFloat(row.pctAssisted) || 0,
                    status: row.status || 'Ongoing'
                  }
                case 'assistance_lgus':
                  return {
                    ...base,
                    type: row.type || '',
                    qty: parseFloat(row.qty) || null,
                    unit: row.unit || '',
                    cost_per_unit: parseFloat(row.costPerUnit) || null,
                    amount: parseFloat(row.amount) || null,
                    source: row.source || '',
                    status: row.status || 'Ongoing'
                  }
                case 'agriculture':
                  return {
                    ...base,
                    classification: row.classification || 'Crop',
                    type: row.type || '',
                    farmers_affected: parseInt(row.farmersAffected) || 0,
                    area_totally_damaged: parseFloat(row.areaTotally) || 0,
                    area_partially_damaged: parseFloat(row.areaPartially) || 0,
                    area_total: parseFloat(row.areaTotal) || 0,
                    infra_totally_damaged: parseFloat(row.infraTotally) || 0,
                    infra_partially_damaged: parseFloat(row.infraPartially) || 0,
                    infra_total: parseFloat(row.infraTotal) || 0,
                    production_loss_volume: parseFloat(row.volumeLoss) || 0,
                    production_loss_value: parseFloat(row.valueLoss) || 0,
                    status: row.status || 'Ongoing'
                  }
                case 'infrastructure':
                  return {
                    ...base,
                    type: row.type || '',
                    classification: row.classification || 'National',
                    infrastructure_name: row.infrastructureName || '',
                    number_damaged: parseInt(row.numberDamaged) || 0,
                    unit: row.unit || '',
                    quantity: parseFloat(row.quantity) || 0,
                    cost: parseFloat(row.cost) || 0,
                    status: row.status || 'Ongoing'
                  }
                default:
                  return base
              }
            }

            const toInsert = validRows.filter(r => !r.id).map(r => preparePayload(r))
            const toUpdate = validRows.filter(r => r.id).map(r => ({ ...preparePayload(r), id: r.id }))

            if (toInsert.length > 0) await api.post(`/reports/${table}/bulk`, toInsert)
            if (toUpdate.length > 0) await api.patch(`/reports/${table}/bulk`, toUpdate)
          }

          showSuccess('Success', `${categoryTitle} report(s) updated!`)
          handleCloseActiveModal()
          await fetchReports()
          if (currentSituationalReport?.id) {
            await markSitRepNotificationsAsRead(currentSituationalReport.id)
          }
        } catch (err) {
          const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to submit report'
          const reportInfo = typeof reportId !== 'undefined' ? ` (Report ID: ${reportId})` : ''
          showToast('Error', `${errorMsg}${reportInfo}`, 'danger')
        } finally {
          setSubmitting(false)
        }
      }
    })
  }

  const renderUnifiedForm = () => {
    const tableHeader = () => {
      switch (activeCategoryModal) {
        case 'power':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Type</th>
              <th style={{ textAlign: 'center' }}>Service Provider</th>
              <th style={{ textAlign: 'center' }}>Date/Time of Interruption/Outage</th>
              <th style={{ textAlign: 'center' }}>Date/Time Restored</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'water':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Type</th>
              <th style={{ textAlign: 'center' }}>Service Provider</th>
              <th style={{ textAlign: 'center' }}>Date/Time of Interruption</th>
              <th style={{ textAlign: 'center' }}>Date/Time Restored</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'roads':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Road Section/Bridge</th>
              <th style={{ textAlign: 'center' }}>Classification</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Date/Time Not Passable</th>
              <th style={{ textAlign: 'center' }}>Date/Time Passable</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'incidents':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Type of Incident</th>
              <th style={{ textAlign: 'center' }}>Date/Time of Occurrence</th>
              <th style={{ textAlign: 'center' }}>Description</th>
              <th style={{ textAlign: 'center' }}>Actions Taken</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'houses':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Totally Damaged</th>
              <th style={{ textAlign: 'center' }}>Partially Damaged</th>
              <th style={{ textAlign: 'center' }}>Grand Total</th>
              <th style={{ textAlign: 'center' }}>Amount (PHP)</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'class':
        case 'work':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              {activeCategoryModal === 'class' && <th style={{ textAlign: 'center' }}>Education Level</th>}
              <th style={{ textAlign: 'center' }}>Type of Suspension</th>
              <th style={{ textAlign: 'center' }}>Date/Time of Suspension</th>
              <th style={{ textAlign: 'center' }}>Date/Time Resumed</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'calamity':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Type of Calamity</th>
              <th style={{ textAlign: 'center' }}>Count SOC</th>
              <th style={{ textAlign: 'center' }}>Resolution No.</th>
              <th style={{ textAlign: 'center' }}>Date of Resolution</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'preemptive':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Families</th>
              <th style={{ textAlign: 'center' }}>Male Count</th>
              <th style={{ textAlign: 'center' }}>Female Count</th>
              <th style={{ textAlign: 'center' }}>Total Persons</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'assistance':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>No. Families Affected</th>
              <th style={{ textAlign: 'center' }}>Families Req. Asst.</th>
              <th style={{ textAlign: 'center' }}>Needs</th>
              <th style={{ textAlign: 'center' }}>F/NFIs Qty/Unit</th>
              <th style={{ textAlign: 'center' }}>Cost/Unit</th>
              <th style={{ textAlign: 'center' }}>Amount</th>
              <th style={{ textAlign: 'center' }}>Source</th>
              <th style={{ textAlign: 'center' }}>Fam. Assisted</th>
              <th style={{ textAlign: 'center' }}>% Assisted</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'communication':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Telecompany</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Date/Time Interrupted</th>
              <th style={{ textAlign: 'center' }}>Date/Time Restored</th>
              <th className="col-comm-tech" style={{ textAlign: 'center' }}>2G (Op/Tot)</th>
              <th className="col-comm-tech" style={{ textAlign: 'center' }}>3G (Op/Tot)</th>
              <th className="col-comm-tech" style={{ textAlign: 'center' }}>4G (Op/Tot)</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'assistance_lgus':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Source</th>
              <th style={{ textAlign: 'center' }}>Relief Type</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'center' }}>Unit</th>
              <th style={{ textAlign: 'center' }}>Cost/Unit</th>
              <th style={{ textAlign: 'center' }}>Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'agriculture':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Classification</th>
              <th style={{ textAlign: 'center' }}>Commodity/Type</th>
              <th style={{ textAlign: 'center' }}>Farmers Affected</th>
              <th style={{ textAlign: 'center' }}>Area Totally (ha)</th>
              <th style={{ textAlign: 'center' }}>Area Partially (ha)</th>
              <th style={{ textAlign: 'center' }}>Area Total (ha)</th>
              <th style={{ textAlign: 'center' }}>Infra Totally</th>
              <th style={{ textAlign: 'center' }}>Infra Partially</th>
              <th style={{ textAlign: 'center' }}>Volume Loss (MT)</th>
              <th style={{ textAlign: 'center' }}>Value Loss (PHP)</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        case 'infrastructure':
          return (
            <tr>
              {!isLGU && <th className="col-city">City</th>}
              <th className="col-barangay">Barangay</th>
              <th style={{ textAlign: 'center' }}>Infra Type</th>
              <th style={{ textAlign: 'center' }}>Infra Classification</th>
              <th style={{ textAlign: 'center' }}>Infrastructure Name</th>
              <th style={{ textAlign: 'center' }}>Num Damaged</th>
              <th style={{ textAlign: 'center' }}>Qty/Unit</th>
              <th style={{ textAlign: 'center' }}>Cost (PHP)</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th className="col-remarks" style={{ textAlign: 'center' }}>Remarks</th>
              <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          )
        default:
          return null
      }
    }

    const tableRows = () => {
      return rows.map((row, index) => (
        <tr key={index} className="report-table-data-row">

          {!isLGU && (
            <td className="col-city">
              <SearchableSelect
                value={row.city}
                options={LGU_NAMES}
                onChange={(e) => {
                  handleRowChange(index, 'city', e.target.value)
                  handleRowChange(index, 'barangay', '')
                }}
                placeholder="Select city..."
                disabled={isLGU}
              />
            </td>
          )}
          <td className="col-barangay">
            <SearchableSelect
              value={row.barangay}
              options={getBarangaysForCity(row.city || user?.city)}
              onChange={(e) => handleRowChange(index, 'barangay', e.target.value)}
              placeholder="Select..."
            />
          </td>
          {activeCategoryModal === 'roads' && (
            <td><input type="text" value={row.roadBridgeName} onChange={(e) => handleRowChange(index, 'roadBridgeName', e.target.value)} placeholder="Name..." style={{ width: '150px' }} /></td>
          )}
          {activeCategoryModal === 'power' && (
            <>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Restored">Restored</option>
                </select>
              </td>
              <td>
                <SearchableSelect
                  value={row.type}
                  options={['Power Interruption', 'Power Outage', 'Brownout', 'Scheduled Maintenance', 'Emergency Repair', 'Other']}
                  onChange={(e) => handleRowChange(index, 'type', e.target.value)}
                  placeholder="Select..."
                />
              </td>
              <td><input type="text" value={row.serviceProvider} onChange={(e) => handleRowChange(index, 'serviceProvider', e.target.value)} placeholder="Provider" /></td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateInterruption && row.timeInterruption ? `${row.dateInterruption}T${row.timeInterruption.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateInterruption', 'timeInterruption', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateRestored && row.timeRestored ? `${row.dateRestored}T${row.timeRestored.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateRestored', 'timeRestored', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
            </>
          )}
          {activeCategoryModal === 'water' && (
            <>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Scheduled Maintenance">Scheduled Maintenance</option>
                  <option value="Pending">Pending</option>
                </select>
              </td>
              <td>
                <SearchableSelect
                  value={row.type}
                  options={['Water Interruption', 'Water Outage', 'Low Pressure', 'Scheduled Maintenance', 'Emergency Repair', 'Other']}
                  onChange={(e) => handleRowChange(index, 'type', e.target.value)}
                  placeholder="Select..."
                />
              </td>
              <td><input type="text" value={row.serviceProvider} onChange={(e) => handleRowChange(index, 'serviceProvider', e.target.value)} placeholder="Provider" /></td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateInterruption && row.timeInterruption ? `${row.dateInterruption}T${row.timeInterruption.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateInterruption', 'timeInterruption', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateRestored && row.timeRestored ? `${row.dateRestored}T${row.timeRestored.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateRestored', 'timeRestored', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
            </>
          )}
          {activeCategoryModal === 'roads' && (
            <>
              <td>
                <select value={row.classification} onChange={(e) => handleRowChange(index, 'classification', e.target.value)}>
                  <option value="National">National</option>
                  <option value="Provincial">Provincial</option>
                  <option value="Municipal/City">Municipal/City</option>
                  <option value="Barangay">Barangay</option>
                </select>
              </td>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Not Passable">Not Passable</option>
                  <option value="Passable">Passable</option>
                  <option value="Passable to Light Vehicles">Passable to Light Vehicles</option>
                  <option value="Passable to Heavy Vehicles">Passable to Heavy Vehicles</option>
                </select>
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateNotPassable && row.timeNotPassable ? `${row.dateNotPassable}T${row.timeNotPassable.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateNotPassable', 'timeNotPassable', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.datePassable && row.timePassable ? `${row.datePassable}T${row.timePassable.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'datePassable', 'timePassable', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
            </>
          )}
          {activeCategoryModal === 'incidents' && (
            <>
              <td>
                <SearchableSelect
                  value={row.typeOfIncident}
                  options={['Flood', 'Landslide', 'Earthquake', 'Fire', 'Typhoon', 'Storm Surge', 'Drought', 'Other']}
                  onChange={(e) => handleRowChange(index, 'typeOfIncident', e.target.value)}
                  placeholder="Select..."
                />
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateOfOccurrence && row.timeOfOccurrence ? `${row.dateOfOccurrence}T${row.timeOfOccurrence.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateOfOccurrence', 'timeOfOccurrence', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
              <td>
                <div
                  className="remarks-trigger text-trigger-wide"
                  onClick={() => openTextEditorModal(index, 'description', row.description, 'Edit Description')}
                  title={row.description || 'Describe the incident...'}
                >
                  {row.description || <span className="placeholder">Describe...</span>}
                </div>
              </td>
              <td>
                <div
                  className="remarks-trigger text-trigger-wide"
                  onClick={() => openTextEditorModal(index, 'actionsTaken', row.actionsTaken, 'Edit Actions Taken')}
                  title={row.actionsTaken || 'What actions were taken?'}
                >
                  {row.actionsTaken || <span className="placeholder">Action...</span>}
                </div>
              </td>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Investigation">Under Investigation</option>
                </select>
              </td>
            </>
          )}
          {activeCategoryModal === 'houses' && (
            <>
              <td><input type="number" min="0" value={row.totallyDamaged} onChange={(e) => handleRowChange(index, 'totallyDamaged', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.partiallyDamaged} onChange={(e) => handleRowChange(index, 'partiallyDamaged', e.target.value)} placeholder="0" /></td>
              <td style={{ fontWeight: 700, textAlign: 'center' }}>{row.grandTotal}</td>
              <td><input type="number" min="0" step="0.01" value={row.amountPhp} onChange={(e) => handleRowChange(index, 'amountPhp', e.target.value)} placeholder="0.00" /></td>
            </>
          )}
          {(activeCategoryModal === 'class' || activeCategoryModal === 'work') && (
            <>
              {activeCategoryModal === 'class' && (
                <td>
                  <SearchableSelect
                    value={row.level}
                    options={['All Levels', 'Pre-school', 'Elementary', 'High School', 'College', 'Graduate School']}
                    onChange={(e) => handleRowChange(index, 'level', e.target.value)}
                    placeholder="Select..."
                  />
                </td>
              )}
              <td><input type="text" value={row.typeOfSuspension} onChange={(e) => handleRowChange(index, 'typeOfSuspension', e.target.value)} placeholder="Type" /></td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateOfSuspension && row.timeOfSuspension ? `${row.dateOfSuspension}T${row.timeOfSuspension.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateOfSuspension', 'timeOfSuspension', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
              <td>
                <ModernDateTimePicker
                  type="datetime-local"
                  value={row.dateOfResumption && row.timeOfResumption ? `${row.dateOfResumption}T${row.timeOfResumption.substring(0, 5)}` : ''}
                  onChange={(e) => handleDateTimeChange(index, 'dateOfResumption', 'timeOfResumption', e.target.value)}
                  placeholder="Select Date & Time"
                />
              </td>
            </>
          )}
          {activeCategoryModal === 'calamity' && (
            <>
              <td><input type="text" value={row.type} onChange={(e) => handleRowChange(index, 'type', e.target.value)} placeholder="Type" /></td>
              <td><input type="number" min="0" value={row.countSoc} onChange={(e) => handleRowChange(index, 'countSoc', e.target.value)} placeholder="0" /></td>
              <td><input type="text" value={row.resolutionNo} onChange={(e) => handleRowChange(index, 'resolutionNo', e.target.value)} placeholder="Res #" /></td>
              <td>
                <ModernDateTimePicker
                  type="date"
                  value={row.resolutionDate}
                  onChange={(e) => handleRowChange(index, 'resolutionDate', e.target.value)}
                  placeholder="Select Date"
                />
              </td>
            </>
          )}
          {activeCategoryModal === 'preemptive' && (
            <>
              <td><input type="number" min="0" value={row.families} onChange={(e) => handleRowChange(index, 'families', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.maleCount} onChange={(e) => handleRowChange(index, 'maleCount', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.femaleCount} onChange={(e) => handleRowChange(index, 'femaleCount', e.target.value)} placeholder="0" /></td>
              <td style={{ fontWeight: 700, textAlign: 'center' }}>{row.total}</td>
            </>
          )}
          {activeCategoryModal === 'assistance' && (
            <>
              <td><input type="number" min="0" value={row.noFamiliesAffected} onChange={(e) => handleRowChange(index, 'noFamiliesAffected', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.noFamiliesRequiringAssistance} onChange={(e) => handleRowChange(index, 'noFamiliesRequiringAssistance', e.target.value)} placeholder="0" /></td>
              <td><input type="text" value={row.needs} onChange={(e) => handleRowChange(index, 'needs', e.target.value)} placeholder="Food, etc" /></td>
              <td>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <input type="number" min="0" value={row.fnfiQty} onChange={(e) => handleRowChange(index, 'fnfiQty', e.target.value)} placeholder="Qty" style={{ width: '45px' }} />
                  <input type="text" value={row.fnfiUnit} onChange={(e) => handleRowChange(index, 'fnfiUnit', e.target.value)} placeholder="Unit" style={{ width: '45px' }} />
                </div>
              </td>
              <td><input type="number" min="0" value={row.fnfiCostPerUnit} onChange={(e) => handleRowChange(index, 'fnfiCostPerUnit', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.fnfiAmount} onChange={(e) => handleRowChange(index, 'fnfiAmount', e.target.value)} placeholder="0" /></td>
              <td><input type="text" value={row.fnfiSource} onChange={(e) => handleRowChange(index, 'fnfiSource', e.target.value)} placeholder="Source" /></td>
              <td><input type="number" min="0" value={row.noFamiliesAssisted} onChange={(e) => handleRowChange(index, 'noFamiliesAssisted', e.target.value)} placeholder="0" /></td>
              <td style={{ color: '#0f172a', fontWeight: 600 }}>{row.pctFamiliesAssisted}%</td>
            </>
          )}
          {activeCategoryModal === 'communication' && (
            <>
              <td>
                <SearchableSelect
                  value={row.telecompany}
                  options={['Globe Telecom', 'Smart Communications (PLDT)', 'DITO Telecommunity', 'PLDT Home', 'Converge ICT Solutions', 'Sky Fiber', 'Starlink (SpaceX)', 'Other']}
                  onChange={(e) => handleRowChange(index, 'telecompany', e.target.value)}
                  placeholder="Select..."
                />
              </td>
              <td>
                <select value={row.statusOfCommunication} onChange={(e) => handleRowChange(index, 'statusOfCommunication', e.target.value)}>
                  <option value="">Select status...</option>
                  <option value="Operational">Operational</option>
                  <option value="Down">Down</option>
                  <option value="Intermittent">Intermittent</option>
                  <option value="Restored">Restored</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Partial Service">Partial Service</option>
                  <option value="No Service">No Service</option>
                  <option value="Other">Other</option>
                </select>
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <ModernDateTimePicker
                    type="datetime-local"
                    value={row.dateInterruption && row.timeInterruption ? `${row.dateInterruption}T${row.timeInterruption.substring(0, 5)}` : ''}
                    onChange={(e) => handleDateTimeChange(index, 'dateInterruption', 'timeInterruption', e.target.value)}
                    placeholder="Select Date & Time"
                  />
                </div>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <ModernDateTimePicker
                    type="datetime-local"
                    value={row.dateRestoration && row.timeRestoration ? `${row.dateRestoration}T${row.timeRestoration.substring(0, 5)}` : ''}
                    onChange={(e) => handleDateTimeChange(index, 'dateRestoration', 'timeRestoration', e.target.value)}
                    placeholder="Select Date & Time"
                  />
                </div>
                </div>
              </td>
              <td className="col-comm-tech">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    value={row.displayCoverage2g}
                    onChange={(e) => handleSiteCoverageChange(index, '2g', e.target.value)}
                    placeholder="Op/Tot"
                    style={{ width: '45px', textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={row.pctCoverage2g}
                    onChange={(e) => handleRowChange(index, 'pctCoverage2g', e.target.value)}
                    className="comm-tech-pct-input"
                    style={{ width: '30px', textAlign: 'center' }}
                  />
                </div>
              </td>
              <td className="col-comm-tech">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    value={row.displayCoverage3g}
                    onChange={(e) => handleSiteCoverageChange(index, '3g', e.target.value)}
                    placeholder="Op/Tot"
                    style={{ width: '45px', textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={row.pctCoverage3g}
                    onChange={(e) => handleRowChange(index, 'pctCoverage3g', e.target.value)}
                    className="comm-tech-pct-input"
                    style={{ width: '30px', textAlign: 'center' }}
                  />
                </div>
              </td>
              <td className="col-comm-tech">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    value={row.displayCoverage4g}
                    onChange={(e) => handleSiteCoverageChange(index, '4g', e.target.value)}
                    placeholder="Op/Tot"
                    style={{ width: '45px', textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={row.pctCoverage4g}
                    onChange={(e) => handleRowChange(index, 'pctCoverage4g', e.target.value)}
                    className="comm-tech-pct-input"
                    style={{ width: '30px', textAlign: 'center' }}
                  />
                </div>
              </td>
            </>
          )}
          {activeCategoryModal === 'assistance_lgus' && (
            <>
              <td><input type="text" value={row.source} onChange={(e) => handleRowChange(index, 'source', e.target.value)} placeholder="Source Agency" /></td>
              <td><input type="text" value={row.type} onChange={(e) => handleRowChange(index, 'type', e.target.value)} placeholder="Relief Type" /></td>
              <td><input type="number" min="0" value={row.qty} onChange={(e) => handleRowChange(index, 'qty', e.target.value)} placeholder="0" /></td>
              <td><input type="text" value={row.unit} onChange={(e) => handleRowChange(index, 'unit', e.target.value)} placeholder="Unit" /></td>
              <td><input type="number" min="0" value={row.costPerUnit} onChange={(e) => handleRowChange(index, 'costPerUnit', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.amount} onChange={(e) => handleRowChange(index, 'amount', e.target.value)} placeholder="0" /></td>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </td>
            </>
          )}
          {activeCategoryModal === 'agriculture' && (
            <>
              <td>
                <select value={row.classification} onChange={(e) => handleRowChange(index, 'classification', e.target.value)}>
                  <option value="Crop">Crop</option>
                  <option value="Livestock/Poultry">Livestock/Poultry</option>
                  <option value="Fisheries">Fisheries</option>
                  <option value="Agricultural Infrastructure">Agricultural Infrastructure</option>
                </select>
              </td>
              <td><input type="text" value={row.type} onChange={(e) => handleRowChange(index, 'type', e.target.value)} placeholder="Type/Commodity" /></td>
              <td><input type="number" min="0" value={row.farmersAffected} onChange={(e) => handleRowChange(index, 'farmersAffected', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" step="0.01" value={row.areaTotally} onChange={(e) => handleRowChange(index, 'areaTotally', e.target.value)} placeholder="0.00" /></td>
              <td><input type="number" min="0" step="0.01" value={row.areaPartially} onChange={(e) => handleRowChange(index, 'areaPartially', e.target.value)} placeholder="0.00" /></td>
              <td><input type="number" min="0" step="0.01" value={row.areaTotal} onChange={(e) => handleRowChange(index, 'areaTotal', e.target.value)} placeholder="0.00" /></td>
              <td><input type="number" min="0" value={row.infraTotally} onChange={(e) => handleRowChange(index, 'infraTotally', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" value={row.infraPartially} onChange={(e) => handleRowChange(index, 'infraPartially', e.target.value)} placeholder="0" /></td>
              <td><input type="number" min="0" step="0.1" value={row.volumeLoss} onChange={(e) => handleRowChange(index, 'volumeLoss', e.target.value)} placeholder="0.0" /></td>
              <td><input type="number" min="0" step="0.01" value={row.valueLoss} onChange={(e) => handleRowChange(index, 'valueLoss', e.target.value)} placeholder="0.00" /></td>
            </>
          )}
          {activeCategoryModal === 'infrastructure' && (
            <>
              <td><input type="text" value={row.type} onChange={(e) => handleRowChange(index, 'type', e.target.value)} placeholder="e.g. Bridge, Road, Building" /></td>
              <td>
                <select value={row.classification} onChange={(e) => handleRowChange(index, 'classification', e.target.value)}>
                  <option value="National">National</option>
                  <option value="Provincial">Provincial</option>
                  <option value="Municipal/City">Municipal/City</option>
                  <option value="Barangay">Barangay</option>
                </select>
              </td>
              <td><input type="text" value={row.infrastructureName} onChange={(e) => handleRowChange(index, 'infrastructureName', e.target.value)} placeholder="Name of Infra" /></td>
              <td><input type="number" min="0" value={row.numberDamaged} onChange={(e) => handleRowChange(index, 'numberDamaged', e.target.value)} placeholder="0" /></td>
              <td>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <input type="number" min="0" value={row.quantity} onChange={(e) => handleRowChange(index, 'quantity', e.target.value)} placeholder="Qty" style={{ width: '45px' }} />
                  <input type="text" value={row.unit} onChange={(e) => handleRowChange(index, 'unit', e.target.value)} placeholder="Unit" style={{ width: '45px' }} />
                </div>
              </td>
              <td><input type="number" min="0" step="0.01" value={row.cost} onChange={(e) => handleRowChange(index, 'cost', e.target.value)} placeholder="0.00" /></td>
              <td>
                <select value={row.status} onChange={(e) => handleRowChange(index, 'status', e.target.value)}>
                  <option value="Passable">Passable</option>
                  <option value="Not Passable">Not Passable</option>
                  <option value="Ongoing Repair">Ongoing Repair</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </td>
            </>
          )}
          <td className="col-remarks">
            <div
              className="remarks-trigger"
              onClick={() => openTextEditorModal(index, 'remarks', row.remarks, 'Edit Remarks')}
              title={row.remarks || 'Add remarks...'}
            >
              {row.remarks || <span className="placeholder">Add remarks...</span>}
            </div>
          </td>
          <td className="col-actions">
            <Button 
              variant="ghost" 
              color="danger" 
              onClick={() => removeRow(index)} 
              disabled={rows.length <= 1}
              size="sm"
            >
              <Trash size={16} />
            </Button>
          </td>
        </tr>
      ))
    }

    const activeCat = REPORT_CATEGORIES.find(c => c.id === activeCategoryModal)
    
    return (
      <div className="report-table-card modern-report-container">
        <div className="consolidated-report-table-wrapper">
          <table className="consolidated-report-table">
            <thead>{tableHeader()}</thead>
            <tbody>{tableRows()}</tbody>
          </table>
          <div className="table-footer-actions">
            <Button 
              variant="subtle" 
              color="primary" 
              size="sm" 
              onClick={addRow}
              leftIcon={<Plus size={16} />}
              className="add-row-bottom-btn"
            >
              Add New Row
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const navigateTo = (newView, data = {}) => {
    setView(newView)
    if (data.event !== undefined) {
      setSelectedEvent(data.event)
      if (data.event?.id) markEventNotificationsAsRead(data.event.id)
    }
    if (data.sitrep !== undefined) {
      setCurrentSituationalReport(data.sitrep)
      if (data.sitrep?.id) markSitRepNotificationsAsRead(data.sitrep.id)
    }

    if (newView === 'events') {
      setSelectedEvent(null)
      setCurrentSituationalReport(null)
    } else if (newView === 'versions') {
      setCurrentSituationalReport(null)
    }

    setCurrentPage(1)
    setSearchTerm('')
  }

  const handleConfirmDelete = (item) => {
    showConfirm({
      title: 'Delete Report',
      message: 'Are you sure you want to delete this report? This action cannot be undone.',
      onConfirm: () => deleteReport(item)
    })
  }

  return (
    <div className="page consolidated-report-page">
      <div className="consolidated-report-card">
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            <h1 className="consolidated-report-title">
              {view === 'events' ? 'Situational Reports' :
                view === 'versions' ? (selectedEvent?.name || 'Report Versions') :
                  (currentSituationalReport?.title || 'Report Entries')}
            </h1>
          </div>

          <div className="consolidated-report-toolbar-controls">
            <SearchInput
              placeholder={view === 'events' ? "Search events..." : "Search reports..."}
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setCurrentPage(1)
              }}
              suggestions={view === 'events' ? events.map(e => e.name) : submittedReports.map((r) => r.location)}
              className="consolidated-report-search-box"
            />
            {view === 'events' && (
              <Button 
                variant="solid" 
                color="primary" 
                onClick={() => openSelectEventModal('versions', (ev) => {
                   navigateTo('versions', { event: ev })
                })} 
                leftIcon={<Plus size={18} />}
                className="toolbar-action-btn add-entry-btn"
              >
                Make Report
              </Button>
            )}
            {(view === 'versions' || view === 'entries') && (
              <>
                {view === 'entries' && (
                  <>
                    {currentSituationalReport && !isLGU && (
                      <Button
                        variant="solid"
                        color="warning"
                        onClick={() => handleOpenEditSitRepModal(currentSituationalReport)}
                        title="Edit Report Details"
                        className="toolbar-action-btn"
                        leftIcon={<PencilSimple size={16} />}
                      >
                        Edit Report
                      </Button>
                    )}
                    <Button 
                      variant="solid"
                      color="success"
                      onClick={() => handleReportDownload(currentSituationalReport)}
                      disabled={processingExportId === currentSituationalReport?.id}
                      className="toolbar-action-btn"
                      leftIcon={processingExportId === currentSituationalReport?.id ? <LoadingSpinner size={14} /> : <Download size={16} />}
                    >
                      Download Report
                    </Button>

                    {/* LGU Submit button (direct submit, no approval gate) */}
                    {(isLGU || isSuperAdmin) && currentSituationalReport && (
                      <Button
                        variant="solid"
                        color={lguSubmissionStatus === 'Submitted' || lguSubmissionStatus === 'Approved' ? 'success' : 'primary'}
                        onClick={lguSubmissionStatus === 'Submitted' || lguSubmissionStatus === 'Approved' ? undefined : handleLguSubmit}
                        disabled={submittingLgu || lguSubmissionStatus === 'Submitted' || lguSubmissionStatus === 'Approved'}
                        isLoading={submittingLgu}
                        className="toolbar-action-btn"
                        leftIcon={
                          lguSubmissionStatus === 'Submitted' || lguSubmissionStatus === 'Approved' ? <CheckCircle size={16} /> :
                          <PaperPlaneRight size={16} />
                        }
                        title={
                          lguSubmissionStatus === 'Rejected' ? `Rejected: ${lguSubmissionRemarks || 'No remarks'}` :
                          lguSubmissionStatus === 'Approved' ? 'Your data has been submitted and is visible to Provincial/Regional users' :
                          lguSubmissionStatus === 'Submitted' ? 'Your data has been submitted successfully' :
                          'Submit your data to Provincial and Regional users'
                        }
                      >
                        {lguSubmissionStatus === 'Submitted' || lguSubmissionStatus === 'Approved' ? 'Submitted ✓' :
                         lguSubmissionStatus === 'Rejected' ? 'Resubmit' :
                         'Submit Data'}
                      </Button>
                    )}
                  </>
                )}

                {/* Everyone can create new Situation Reports in the new flow. Everyone can add entries to an existing report. */}
                {(view === 'entries' || view === 'versions') && (
                  <Button 
                    variant="solid" 
                    color="primary" 
                    onClick={() => {
                      if (view === 'versions') {
                        setNewSitRepTitle(`Situational Report No. ${situationalReports.length + 1}`)
                        setPingedCategories(Object.keys(CATEGORY_LABELS))
                        setTargetLgus([])
                        setSelectedProvinces(userProvince ? [userProvince] : [])
                        setShowNewSitRepModal(true)
                      } else {
                        setShowCategoryModal(true)
                      }
                    }} 
                    leftIcon={<Plus size={18} />}
                    className="toolbar-action-btn add-entry-btn"
                  >
                    {view === 'versions' ? 'Make Report' : 'Add Entry'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Breadcrumbs Navigation */}
        <div className="breadcrumb-nav">
          <button
            className={`breadcrumb-item ${view === 'events' ? 'active' : ''}`}
            onClick={() => navigateTo('events')}
          >
            Events
          </button>
          {selectedEvent && (
            <>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${view === 'versions' ? 'active' : ''}`}
                onClick={() => navigateTo('versions')}
              >
                {selectedEvent.name}
              </button>
            </>
          )}
          {currentSituationalReport && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">{currentSituationalReport.title}</span>
            </>
          )}
        </div>

        {error && (
          <div className="add-report-error" role="alert">
            {error}
          </div>
        )}

        {view === 'events' ? (
          <div className="add-report-event-view">
            <div className="consolidated-report-table-wrapper">
              <table className="consolidated-report-table report-table-display add-report-display-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Event Name</th>
                    <th style={{ textAlign: 'left' }}>Event Type</th>
                    <th style={{ textAlign: 'left', width: '120px' }}>Alert Status</th>
                    <th style={{ textAlign: 'left', width: '150px' }}>Reference Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.length > 0 ? (
                    paginatedEvents.map((ev) => (
                      <tr
                        key={ev.id}
                        className="report-table-data-row clickable-row"
                        onClick={() => {
                          navigateTo('versions', { event: ev })
                        }}
                      >
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          {hasUnread(ev.id) && (
                            <span 
                              className="table-ping" 
                              title="Clear Notifications" 
                              onClick={(e) => {
                                e.stopPropagation();
                                markEventNotificationsAsRead(ev.id);
                              }}
                              style={{ cursor: 'pointer' }}
                            ></span>
                          )}
                          {ev.name}
                        </td>
                        <td style={{ color: '#334155' }}>
                          {ev.eventType}
                        </td>
                        <td>
                          <span className={`status-pill status-${(ev.alertStatus || 'white').toLowerCase()}`}>
                            {ev.alertStatus === 'blue' ? 'Standard' :
                              ev.alertStatus === 'red' ? 'Critical' :
                                ev.alertStatus === 'orange' ? 'Warning' : 'Normal'}
                          </span>
                        </td>
                        <td className="col-date">
                          {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : 'No date'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        No events found matching your search.
                      </td>
                    </tr>
                  )}
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
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Page {currentPage} of {totalEventPages}
                </span>
              </div>
              <Button
                variant="subtle"
                disabled={currentPage >= totalEventPages}
                onClick={() => setCurrentPage((p) => Math.min(totalEventPages, p + 1))}
              >
                Next &gt;
              </Button>
            </div>
          </div>
        ) : view === 'versions' ? (
          <div className="add-report-event-view">
            <div className="consolidated-report-table-wrapper">
              <table className="consolidated-report-table report-table-display add-report-display-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px', textAlign: 'left' }}>Report Number</th>
                    <th style={{ textAlign: 'left' }}>Report Title</th>
                    <th style={{ width: '150px', textAlign: 'left' }}>Creator</th>
                    {(isSuperAdmin || isRegional) && (
                      <th style={{ width: '150px', textAlign: 'left' }}>Province</th>
                    )}
                    <th style={{ width: '180px', textAlign: 'left' }}>Date Created</th>
                    <th style={{ width: '150px', textAlign: 'left' }}>Status</th>
                    <th className="col-action" style={{ width: '280px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {situationalReports.length > 0 ? (
                    situationalReports.map((sr) => (
                      <tr
                        key={sr.id}
                        className="report-table-data-row clickable-row"
                        onClick={() => navigateTo('entries', { sitrep: sr })}
                      >
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          Report No. {sr.report_number}
                        </td>
                        <td style={{ color: '#334155' }}>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                             {hasUnread(selectedEvent?.id, sr.id) && (
                               <span 
                                 className="table-ping" 
                                 title="Clear Notifications" 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   markSitRepNotificationsAsRead(sr.id);
                                 }}
                                 style={{ cursor: 'pointer' }}
                               ></span>
                             )}
                            {sr.title}
                          </div>
                          {sr.rejection_remarks && (
                            <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Warning size={12} />
                              <span>Rejection: {sr.rejection_remarks}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ color: '#334155' }}>
                          {sr.creator_city ? sr.creator_city : (sr.creator_name || '-')}
                        </td>
                        {(isSuperAdmin || isRegional) && (
                          <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                            {sr.province || '-'}
                          </td>
                        )}
                        <td className="col-date">
                          {sr.created_at ? new Date(sr.created_at).toLocaleString() : 'No date'}
                        </td>
                        <td>
                          <span className={`status-pill status-${(sr.status || 'draft').toLowerCase()}`}>
                            {sr.status || 'Draft'}
                          </span>
                        </td>
                        <td className="col-action" onClick={(e) => e.stopPropagation()} style={{ width: '200px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                            <Button variant="solid" color="primary" size="sm"
                              onClick={() => { setCurrentSituationalReport(sr); setView('entries'); setCurrentPage(1); }}
                              icon={<FileText size={14} />}>
                              Manage
                            </Button>
                            
                            {/* Send Button: visible to LGU (to Province) and Provincial/Admin (to Regional/Super Admin) */}
                            {((isLGU && sr.status === 'Draft') || (isProvincial || isSuperAdmin || isRegional)) && (
                              <Button variant="solid" color="success" size="sm"
                                onClick={() => handleUploadPdfClick(sr)}
                                icon={<Upload size={14} />}>
                                {isLGU ? 'Send to Prov' : 'Send'}
                              </Button>
                            )}

                            {/* Review Button: visible to Provincial users for LGU reports pending review */}
                            {isProvincial && sr.status === 'Pending Provincial Review' && (
                              <Button variant="solid" color="warning" size="sm"
                                onClick={() => handleOpenReviewModal(sr)}
                                icon={<Eye size={14} />}>
                                Review
                              </Button>
                            )}
                            
                            <Button variant="ghost" color="success" size="sm"
                              onClick={() => handleReportDownload(sr)}
                              icon={<Download size={14} />}>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        No situational reports found for this event. Click "Make Report" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : loading ? (
          <LoadingSpinner label="Loading report data..." />
        ) : submittedReports.length > 0 || view === 'entries' ? (
          <>
            <div className="consolidated-report-table-wrapper">
              <table className="consolidated-report-table report-table-display add-report-display-table">
                <thead>
                  <tr>
                    <th style={{ width: '200px', textAlign: 'left' }}>LOCATION</th>
                    <th style={{ width: '180px', textAlign: 'left' }}>CLASSIFICATION</th>
                    <th style={{ textAlign: 'left' }}>SUMMARY / DETAILS</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>STATUS</th>
                    <th className="col-action" style={{ width: '250px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((item, idx) => (
                      <tr key={item.id || idx} className="report-table-data-row">
                        <td className="col-barangay" style={{ verticalAlign: 'middle', padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '12px' }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: REPORT_CATEGORIES.find(c => c.id === item.category)?.color || '#94a3b8',
                                flexShrink: 0
                              }}></span>
                            </div>
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '12.5px' }}>
                              {item.location || item.city || 'Entry'}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: '#475569', fontSize: '12.5px', fontWeight: 700, verticalAlign: 'middle', textTransform: 'uppercase', padding: '8px 12px' }}>
                          {item.categoryTitle}
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#334155', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.subject}</span>
                          {item.summary && <span style={{ color: '#64748b' }}> | {item.summary}</span>}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 12px', fontSize: '12.5px' }}>
                          {(() => {
                            const s = item.status || 'Resolved'
                            const slug = String(s).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'pending'
                            return (
                              <span className={`status-pill status-${slug}`}>
                                {s}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="col-action" style={{ width: '250px', padding: '6px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                            <Button
                              variant="solid"
                              color="info"
                              size="sm"
                              onClick={() => handleEditReport(item)}
                              icon={<FilePlus size={14} />}
                            >
                              Edit Entry
                            </Button>
                            <Button
                              variant="solid"
                              size="sm"
                              color="danger"
                              onClick={() => handleConfirmDelete(item)}
                              title="Delete Report"
                              icon={<Trash size={14} />}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        No entries found for this situational report. Click "Add Entry" to start.
                      </td>
                    </tr>
                  )}
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
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Page {currentPage} of {totalPages}
                </span>
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
          <div className="add-report-empty">
            No reports yet. Click &quot;Add Report&quot; to create one.
          </div>
        ) : null}
      </div>

{showCategoryModal && (
  <CategorySelectionModal
    onClose={() => setShowCategoryModal(false)}
    onSelect={handleCategorySelect}
    pingedReportTypes={currentSituationalReport?.pinged_report_types || selectedEvent?.pingedReportTypes || []}
    submittedCategories={new Set(submittedReports.map(r => r.category))}
  />
)}
      <HeaderFooterModal
        isOpen={!!detailsModal}
        onClose={() => setDetailsModal(null)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: REPORT_CATEGORIES.find(c => c.id === detailsModal?.category)?.color }}>
              {REPORT_CATEGORIES.find(c => c.id === detailsModal?.category)?.icon}
            </div>
            <span>{detailsModal?.categoryLabel} Details</span>
          </div>
        }
        maxWidth="950px"
        footer={<Button variant="solid" onClick={() => setDetailsModal(null)}>Close</Button>}
      >
        {detailsModal && (
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Location</span>
              <span className="detail-value">{detailsModal.city ? `${detailsModal.city}, ` : ''}{detailsModal.subject}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className={`status-pill status-${String(detailsModal.status || 'resolved').toLowerCase().replace(/\s+/g, '-')}`}>
                {detailsModal.status || 'Resolved'}
              </span>
            </div>
            {Object.entries(detailsModal).map(([key, val]) => {
              if (['id', 'category', 'categoryLabel', 'subject', 'timestamp', 'status', 'city', 'barangay', 'event_id', 'report_id', 'created_at', 'submitted_at', 'tableName'].includes(key)) return null
              if (val === null || val === undefined || val === '') return null

              const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              return (
                <div className="detail-item" key={key}>
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{String(val)}</span>
                </div>
              )
            })}
            {detailsModal.remarks && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', gridColumn: '1 / -1' }}>
                <span className="detail-label" style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Remarks</span>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{detailsModal.remarks}</p>
              </div>
            )}
          </div>
        )}
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={activeCategoryModal === 'evacuation'}
        onClose={handleCloseActiveModal}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: '#3b82f6' }}> 
              <Users size={24} />
            </div>
            <span>Affected Population Report</span>
          </div>
        }
        maxWidth="98%"
        footer={
          <>
            <Button variant="subtle" onClick={handleCloseActiveModal}>Cancel</Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSubmit}
              isLoading={submitting}
              leftIcon={<FilePlus size={16} />}
            >
              Submit Report
            </Button>
          </>
        }
      >
        <div className="report-table-card modern-report-container">

          <div className="consolidated-report-table-wrapper">
            <table className="consolidated-report-table">
              <thead>
                <tr className="report-table-header-row-1">
                  <th colSpan={isLGU ? 3 : 4} className="col-group col-barangay" style={{ textAlign: 'center' }}>
                    NO. OF AFFECTED
                  </th>
                  <th colSpan={2} className="col-group" style={{ textAlign: 'center' }}>
                    NO. OF ECS
                  </th>
                  <th colSpan={4} className="col-group" style={{ textAlign: 'center' }}>
                    INSIDE EVACUATION CENTERS
                  </th>
                  <th colSpan={4} className="col-group" style={{ textAlign: 'center' }}>
                    OUTSIDE EVACUATION CENTERS
                  </th>
                  <th rowSpan={2}>Remarks</th>
                  <th rowSpan={2} className="col-actions">Actions</th>
                </tr>
                <tr className="report-table-header-row-2">
                  {!isLGU && <th className="col-city">City</th>}
                  <th className="col-barangay">Barangay</th>
                  <th style={{ textAlign: 'center' }}>Families</th>
                  <th style={{ textAlign: 'center' }}>Persons</th>
                  <th style={{ textAlign: 'center' }}>CUM</th>
                  <th style={{ textAlign: 'center' }}>NOW</th>
                  <th style={{ textAlign: 'center' }}>Fam. CUM</th>
                  <th style={{ textAlign: 'center' }}>Fam. NOW</th>
                  <th style={{ textAlign: 'center' }}>Per. CUM</th>
                  <th style={{ textAlign: 'center' }}>Per. NOW</th>
                  <th style={{ textAlign: 'center' }}>Fam. CUM</th>
                  <th style={{ textAlign: 'center' }}>Fam. NOW</th>
                  <th style={{ textAlign: 'center' }}>Per. CUM</th>
                  <th style={{ textAlign: 'center' }}>Per. NOW</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="report-table-data-row">
                    {!isLGU && (
                      <td className="col-city">
                        <SearchableSelect
                          value={row.city}
                          options={LGU_NAMES}
                          onChange={(e) => {
                            handleRowChange(rowIndex, 'city', e.target.value)
                            handleRowChange(rowIndex, 'barangay', '')
                          }}
                          placeholder="Select city..."
                          disabled={isLGU}
                        />
                      </td>
                    )}
                    <td className="col-barangay">
                      <SearchableSelect
                        value={row.barangay}
                        options={getBarangaysForCity(row.city || user?.city)}
                        onChange={(e) =>
                          handleRowChange(rowIndex, 'barangay', e.target.value)
                        }
                        placeholder="Select barangay..."
                        disabled={!row.city}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.affectedFamilies}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'affectedFamilies',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.affectedPersons}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'affectedPersons',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.ecsCum}
                        onChange={(e) =>
                          handleRowChange(rowIndex, 'ecsCum', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.ecsNow}
                        onChange={(e) =>
                          handleRowChange(rowIndex, 'ecsNow', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.insideFamiliesCum}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'insideFamiliesCum',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.insideFamiliesNow}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'insideFamiliesNow',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.insidePersonsCum}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'insidePersonsCum',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.insidePersonsNow}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'insidePersonsNow',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.outsideFamiliesCum}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'outsideFamiliesCum',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.outsideFamiliesNow}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'outsideFamiliesNow',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.outsidePersonsCum}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'outsidePersonsCum',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.outsidePersonsNow}
                        onChange={(e) =>
                          handleRowChange(
                            rowIndex,
                            'outsidePersonsNow',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <div
                        className="remarks-trigger"
                        onClick={() => openTextEditorModal(rowIndex, 'remarks', row.remarks, 'Edit Remarks')}
                        title={row.remarks || 'Add remarks...'}
                      >
                        {row.remarks || <span className="placeholder">Add remarks...</span>}
                      </div>
                    </td>
                    <td className="col-actions">
                      <Button
                        variant="ghost"
                        color="danger"
                        size="sm"
                        onClick={() => removeRow(rowIndex)}
                        title="Remove row"
                        disabled={rows.length === 1}
                      >
                        <Trash size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer-actions">
              <Button 
                variant="subtle" 
                color="primary" 
                size="sm" 
                onClick={addRow}
                leftIcon={<Plus size={16} />}
                className="add-row-bottom-btn"
              >
                Add New Row
              </Button>
            </div>
          </div>
        </div>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={activeCategoryModal && activeCategoryModal !== 'evacuation'}
        onClose={handleCloseActiveModal}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: REPORT_CATEGORIES.find(c => c.id === activeCategoryModal)?.color }}>
              {REPORT_CATEGORIES.find(c => c.id === activeCategoryModal)?.icon}
            </div>
            <span>{REPORT_CATEGORIES.find(c => c.id === activeCategoryModal)?.title}</span>
          </div>
        }
        maxWidth="98%"
        footer={
          <>
            <Button variant="subtle" onClick={handleCloseActiveModal}>Cancel</Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSubmit}
              isLoading={submitting}
              leftIcon={<FilePlus size={18} />}
            >
              Submit Report
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {renderUnifiedForm()}
        </div>
      </HeaderFooterModal>

      {/* New Situation Report Modal */}
      <HeaderFooterModal
        isOpen={showNewSitRepModal}
        onClose={() => setShowNewSitRepModal(false)}
        title="New Situation Report"
        maxWidth="750px"
        footer={
          <>
            <Button variant="subtle" onClick={() => setShowNewSitRepModal(false)} disabled={submitting}>Cancel</Button>
            <Button variant="solid" onClick={handleCreateSitRep} isLoading={submitting} disabled={!newSitRepTitle.trim()}>
              Create Report
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>Report Title</label>
            <input
              type="text"
              className="modern-input"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem' }}
              value={newSitRepTitle}
              onChange={(e) => setNewSitRepTitle(e.target.value)}
              placeholder="e.g. Situational Report No. 1"
              autoFocus
            />
          </div>

          {/* Inherit data checkbox — only shown when a previous SitRep exists */}
          {situationalReports.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '10px',
              border: `1px solid ${shouldInheritData ? '#3b82f6' : '#e2e8f0'}`,
              background: shouldInheritData ? 'rgba(59,130,246,0.05)' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
              onClick={() => setShouldInheritData(prev => !prev)}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                border: `2px solid ${shouldInheritData ? '#3b82f6' : '#cbd5e1'}`,
                background: shouldInheritData ? '#3b82f6' : '#fff',
                flexShrink: 0,
                marginTop: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                {shouldInheritData && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: shouldInheritData ? '#1e40af' : '#334155' }}>
                  Auto-clone data from previous report
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Automatically copies data from <strong style={{ color: '#475569' }}>
                    {[...situationalReports].sort((a,b) => (b.report_number||0)-(a.report_number||0))[0]?.title || 'the latest report'}
                  </strong> into this new report. Based on your role, only relevant data (e.g., your LGU or Province) will be cloned. You can edit what changed.
                </div>
              </div>
            </div>
          )}

          {(isSuperAdmin || isRegional) && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.75rem' }}>Select Provinces to Include</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PROVINCE_NAMES.map(p => {
                  const isActive = selectedProvinces.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        if (isActive) {
                          setSelectedProvinces(prev => prev.filter(x => x !== p))
                          // Optional: Remove LGUs from this province when untoggled
                          const lgusInProvince = getLguNames(p)
                          setTargetLgus(prev => prev.filter(l => !lgusInProvince.includes(l)))
                        } else {
                          setSelectedProvinces(prev => [...prev, p])
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        border: '1px solid',
                        borderColor: isActive ? T.blue : '#e2e8f0',
                        background: isActive ? 'rgba(59,130,246,0.1)' : '#fff',
                        color: isActive ? T.blue : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Target LGUs ({targetLgus.length})</label>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  const allNames = selectedProvinces.length > 0 
                    ? selectedProvinces.flatMap(p => getLguNames(p))
                    : getLguNames(userProvince)
                  setTargetLgus(prev => Array.from(new Set([...prev, ...allNames])).sort())
                }}
              >
                Select All LGUs
              </Button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                Add LGU from {selectedProvinces.join(', ') || userProvince || 'Region'}
              </label>
              <SearchableSelect
                options={
                  (selectedProvinces.length > 0 ? selectedProvinces : [userProvince || ''])
                  .flatMap(p => getLguNames(p))
                  .filter(name => !targetLgus.includes(name))
                  .map(name => ({ value: name, label: name }))
                }
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !targetLgus.includes(val)) {
                    setTargetLgus(prev => [...prev, val].sort());
                  }
                }}
                placeholder="Search and select LGU..."
              />
            </div>

            {/* Selected LGUs Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', minHeight: '100px', alignContent: 'flex-start' }}>
              {targetLgus.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No LGUs selected. This report will be visible to all LGUs in {userProvince} by default.
                </div>
              ) : (
                targetLgus.map((lgu) => (
                  <div key={lgu} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.875rem', color: '#334155', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    {lgu}
                    <X size={14} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setTargetLgus(prev => prev.filter(item => item !== lgu))} />
                  </div>
                ))
              )}
            </div>

            {targetLgus.length > 0 && (
              <button type="button" onClick={() => setTargetLgus([])} style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </HeaderFooterModal>

      {/* Edit Situation Report Modal */}
      <HeaderFooterModal
        isOpen={showEditSitRepModal}
        onClose={() => {
          setShowEditSitRepModal(false)
          setEditingSitRep(null)
        }}
        title="Edit Situational Report"
        maxWidth="750px"
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => {
                setShowEditSitRepModal(false)
                setEditingSitRep(null)
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleUpdateSitRep}
              isLoading={submitting}
              disabled={!newSitRepTitle.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>Report Title</label>
            <input
              type="text"
              className="modern-input"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem' }}
              value={newSitRepTitle}
              onChange={(e) => setNewSitRepTitle(e.target.value)}
              placeholder="e.g. Situational Report No. 5"
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>Target LGUs ({targetLgus.length})</label>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  const names = getLguNames(userProvince)
                  setTargetLgus(prev => Array.from(new Set([...prev, ...names])).sort())
                }}
              >
                Select All LGUs
              </Button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>Add LGU from {userProvince || 'Region'}</label>
              <SearchableSelect
                options={getLguNames(userProvince).filter(name => !targetLgus.includes(name)).map(name => ({ value: name, label: name }))}
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !targetLgus.includes(val)) {
                    setTargetLgus(prev => [...prev, val].sort());
                  }
                }}
                placeholder="Search and select LGU..."
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', minHeight: '100px', alignContent: 'flex-start' }}>
              {targetLgus.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No LGUs selected. This report will be visible to all LGUs in {userProvince} by default.
                </div>
              ) : (
                targetLgus.map((lgu) => (
                  <div key={lgu} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.875rem', color: '#334155', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    {lgu}
                    <X size={14} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setTargetLgus(prev => prev.filter(item => item !== lgu))} />
                  </div>
                ))
              )}
            </div>

            {targetLgus.length > 0 && (
              <button type="button" onClick={() => setTargetLgus([])} style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={showTextEditorModal}
        onClose={() => setShowTextEditorModal(false)}
        title={textEditorModalData?.title || 'Edit Text'}
        maxWidth="500px"
        footer={
          <>
            <Button variant="subtle" onClick={() => setShowTextEditorModal(false)}>Cancel</Button>
            <Button variant="solid" onClick={saveTextUpdate}>Save Changes</Button>
          </>
        }
      >
        <textarea
          className="remarks-textarea"
          value={textEditorModalData?.tempValue || ''}
          onChange={(e) => setTextEditorModalData({ ...textEditorModalData, tempValue: e.target.value })}
          placeholder={`Enter ${textEditorModalData?.title?.toLowerCase().replace('edit ', '') || 'text'} here...`}
          autoFocus
          style={{ width: '100%', minHeight: '150px', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
        />
      </HeaderFooterModal>
      <HeaderFooterModal
        isOpen={showSignatoriesModal}
        onClose={() => {
          setShowSignatoriesModal(false);
          if (signatoriesReturnToPdf) {
            setShowPdfEditModal(true);
            setSignatoriesReturnToPdf(false);
          }
        }}
        title="Configure Report Signatories"
        subtitle="Select the personnel who will sign this report. You can search by name or office."
        maxWidth="1000px"
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => {
                setShowSignatoriesModal(false);
                if (signatoriesReturnToPdf) {
                  setShowPdfEditModal(true);
                  setSignatoriesReturnToPdf(false);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              disabled={preparedBy.length === 0}
              onClick={() => {
                if (signatoriesReturnToPdf) {
                  setShowSignatoriesModal(false);
                  setShowPdfEditModal(true);
                  setSignatoriesReturnToPdf(false);
                  const params = generatedSummaryData?.pdfParams;
                  if (params) {
                    if (pdfPreviewBlobUrl) URL.revokeObjectURL(pdfPreviewBlobUrl);
                    const newUrl = generatePdfBlobUrl(params, aiGeneratedSummaryText, { preparedBy, notedBy, approvedBy });
                    setPdfPreviewBlobUrl(newUrl);
                  }
                } else {
                  handleConfirmDownload();
                }
              }}
              leftIcon={signatoriesReturnToPdf ? <Check size={16} /> : <FileArrowDown size={16} />}
            >
              {signatoriesReturnToPdf ? 'Apply Signatories' : 'Download PDF'}
            </Button>
          </>
        }
      >
        <div className="signatory-role-tabs">
          <button
            className={`role-tab ${signatoryRole === 'preparedBy' ? 'active' : ''}`}
            onClick={() => handleSignatoryRoleChange('preparedBy')}
          >
            Prepared By ({preparedBy.length})
          </button>
          <button
            className={`role-tab ${signatoryRole === 'notedBy' ? 'active' : ''}`}
            onClick={() => handleSignatoryRoleChange('notedBy')}
          >
            Noted By {notedBy ? '✓' : ''}
          </button>
          <button
            className={`role-tab ${signatoryRole === 'approvedBy' ? 'active' : ''}`}
            onClick={() => handleSignatoryRoleChange('approvedBy')}
          >
            Approved By {approvedBy ? '✓' : ''}
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <SearchInput
            placeholder="Search signatories..."
            value={signatorySearch}
            onChange={setSignatorySearch}
          />
        </div>

        <div className="signatories-list">
          {loadingSignatories ? (
            <LoadingSpinner label="Fetching personnel..." />
          ) : (
            availableSignatories
              .filter(s => s.name.toLowerCase().includes(signatorySearch.toLowerCase()) || s.office.toLowerCase().includes(signatorySearch.toLowerCase()))
              .map(sig => {
                const isSelected = signatoryRole === 'preparedBy'
                  ? preparedBy.some(s => s.id === sig.id)
                  : (signatoryRole === 'notedBy' ? notedBy?.id === sig.id : approvedBy?.id === sig.id)

                return (
                  <div
                    key={sig.id}
                    className={`signatory-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSignatory(sig)}
                  >
                    <div className="signatory-info">
                      <span className="sig-name">{sig.name}</span>
                      <span className="sig-designation">{sig.designation}</span>
                      <span className="sig-office">{sig.office}</span>
                    </div>
                    {isSelected && <Check size={18} color="#10b981" />}
                  </div>
                )
              })
          )}
        </div>
      </HeaderFooterModal>
      <HeaderFooterModal
        isOpen={showDownloadTypeModal}
        onClose={() => setShowDownloadTypeModal(false)}
        title="Select Download Format"
        subtitle="Choose the preferred format for your situational report."
        maxWidth="750px"
        footer={<Button variant="subtle" onClick={() => setShowDownloadTypeModal(false)}>Cancel</Button>}
      >
        <div className="download-options-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '400px', margin: '0 auto' }}>
          <div className="download-option-card" onClick={() => {
            setShowDownloadTypeModal(false)
            setShowPdfEditModal(true)
          }}>
            <div className="download-option-icon"><FileText size={32} /></div>
            <div className="download-option-title">PDF Document</div>
          </div>
        </div>
      </HeaderFooterModal>

      {/* Upload PDF Modal — Provincial User */}
      <HeaderFooterModal
        isOpen={showApprovalUploadModal}
        onClose={() => setShowApprovalUploadModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="sitrep-badge" style={{ background: '#2563eb' }}>UPLOAD</span>
            <span>Upload Signed PDF</span>
          </div>
        }
        subtitle="Upload the signed situational report PDF. It will be sent to the Provincial Approver for review."
        maxWidth="650px"
        footer={
          <>
            <Button variant="subtle" onClick={() => setShowApprovalUploadModal(false)}>Cancel</Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleUploadPdfSubmit}
              isLoading={uploadingApproval}
              disabled={!approvalFile}
              leftIcon={<Upload size={15} />}
            >
              Submit for Approval
            </Button>
          </>
        }
      >
        <div
          className={`approval-file-upload ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type === 'application/pdf') {
              setApprovalFile(file);
            } else if (file) {
              showToast('Validation Error', 'Only PDF files are allowed.', 'warning');
            }
          }}
        >
          <input
            id="approval-pdf-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
            className="approval-file-input-hidden"
            style={{ display: 'none' }}
          />
          {!approvalFile ? (
            <label htmlFor="approval-pdf-input" className="approval-file-upload-label modern-upload-label">
              <div className="modern-upload-icon-wrapper">
                <Upload size={32} className="approval-upload-icon modern-icon" />
              </div>
              <span className="approval-upload-text"><strong>Click to upload</strong> or drag and drop</span>
              <span className="approval-upload-hint">PDF files only (Max. 10MB)</span>
            </label>
          ) : (
            <div className="approval-file-selected modern-file-selected">
              <div className="modern-file-info">
                <div className="modern-file-icon-wrapper">
                  <FileArrowDown size={24} className="approval-file-icon modern-file-icon" />
                </div>
                <div className="modern-file-details">
                  <span className="approval-file-name" title={approvalFile.name}>{approvalFile.name}</span>
                  <span className="approval-file-size">{(approvalFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => {
                  setApprovalFile(null)
                  const input = document.getElementById('approval-pdf-input')
                  if (input) input.value = ''
                }}
                title="Remove file"
              >
                <X size={18} />
              </Button>
            </div>
          )}
        </div>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={showPdfEditModal}
        onClose={() => setShowPdfEditModal(false)}
        title="Finalize PDF Report"
        subtitle={generatedSummaryData?.pdfParams?.reportTitle}
        maxWidth="1200px"
        footer={
          <>
            <Button variant="subtle" onClick={() => setShowPdfEditModal(false)}>Cancel</Button>
            <Button variant="solid" onClick={handleConfirmDownload} icon={<Download size={18} />}>Download PDF</Button>
          </>
        }
      >
        {generatedSummaryData && (
          <div style={{ display: 'flex', height: '65vh', gap: '1.5rem', minHeight: 0 }}>
            {/* LEFT: Premium PDF Preview */}
            <div style={{ 
              flex: showPdfPreview ? 1.4 : 0, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem', 
              minWidth: 0,
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              opacity: showPdfPreview ? 1 : 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={16} style={{ color: '#64748b' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#334155' }}>Live Preview</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isSavingSummary && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#3b82f6', fontSize: '0.75rem' }}>
                       <LoadingSpinner size={12} /> Saving...
                     </div>
                  )}
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      if (pdfPreviewBlobUrl) URL.revokeObjectURL(pdfPreviewBlobUrl)
                      const newUrl = generatePdfBlobUrl(generatedSummaryData.pdfParams, aiGeneratedSummaryText, { preparedBy, notedBy, approvedBy })
                      setPdfPreviewBlobUrl(newUrl)
                    }}
                    icon={<ArrowsClockwise size={14} />}
                  >
                    Refresh Preview
                  </Button>
                </div>
              </div>
              <div className="pdf-preview-container" style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {pdfPreviewBlobUrl ? (
                  <iframe
                    key={pdfPreviewBlobUrl}
                    src={pdfPreviewBlobUrl}
                    title="PDF Preview"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingSpinner label="Generating live preview..." />
                  </div>
                )}
              </div>
            </div>

            {/* MIDDLE: Toggle Handle (Vertical) */}
            <div 
              onClick={() => setShowPdfPreview(!showPdfPreview)}
              style={{
                width: '12px',
                height: '100%',
                background: '#f1f5f9',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: '1px solid #e2e8f0'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
              title={showPdfPreview ? "Hide PDF Preview" : "Show PDF Preview"}
            >
              <div style={{ color: '#64748b' }}>
                {showPdfPreview ? <CaretDown size={12} style={{ transform: 'rotate(90deg)' }} /> : <CaretDown size={12} style={{ transform: 'rotate(-90deg)' }} />}
              </div>
            </div>

            {/* RIGHT: Modern Summary Editor & Signatories */}
            <div className="summary-sidebar" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="gemini-badge">
                    <Sparkle size={14} />
                    AI Executive Summary
                  </div>
                  
                  {summaryHistory.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ClockCounterClockwise size={14} style={{ color: '#64748b' }} />
                      <select 
                        style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
                        value={selectedHistoryId}
                        onChange={(e) => {
                          const val = e.target.value
                          setSelectedHistoryId(val)
                          if (val === 'current') return
                          const selected = summaryHistory.find(h => h.id === val)
                          if (selected) {
                            setAiGeneratedSummaryText(selected.summary_text)
                            showToast('History Loaded', `Loaded version from ${new Date(selected.created_at).toLocaleString()}`, 'info')
                          }
                        }}
                      >
                        <option value="current">Select a version...</option>
                        {summaryHistory.map((h, i) => (
                          <option key={h.id} value={h.id}>
                            Version {summaryHistory.length - i} ({new Date(h.created_at).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <textarea
                    className="summary-textarea-modern"
                    value={aiGeneratedSummaryText}
                    onChange={e => {
                      setAiGeneratedSummaryText(e.target.value)
                      if (selectedHistoryId !== 'current') setSelectedHistoryId('current')
                    }}
                    placeholder="Review and refine the report summary..."
                    style={{ flex: 1, resize: 'none' }}
                  />
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowRegenerateConfirm(true)}
                      icon={<Sparkle size={14} />}
                      style={{ flex: 1 }}
                    >
                      Regenerate
                    </Button>
                    <Button 
                      variant="solid" 
                      color="primary"
                      size="sm" 
                      onClick={() => saveSummaryToHistory(aiGeneratedSummaryText)}
                      icon={<FloppyDisk size={14} />}
                      disabled={isSavingSummary || !aiGeneratedSummaryText || aiGeneratedSummaryText.startsWith('Generating')}
                      style={{ flex: 1 }}
                    >
                      Save Version
                    </Button>
                  </div>
                </div>
              </div>

              <div className="signatories-card-modern">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signatories</span>
                </div>
                <div className="sig-grid-modern">
                  <div className="sig-item-modern">
                    <span className="sig-label-modern">Prepared By</span>
                    <span className="sig-value-modern">{preparedBy.length > 0 ? preparedBy.map(p => p.name).join(', ') : 'None'}</span>
                  </div>
                  <div className="sig-item-modern">
                    <span className="sig-label-modern">Noted By</span>
                    <span className="sig-value-modern">{notedBy ? notedBy.name : 'None'}</span>
                  </div>
                  <div className="sig-item-modern">
                    <span className="sig-label-modern">Approved By</span>
                    <span className="sig-value-modern">{approvedBy ? approvedBy.name : 'None'}</span>
                  </div>
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => { 
                    setSignatoriesReturnToPdf(true);
                    setShowPdfEditModal(false); 
                    setShowSignatoriesModal(true); 
                  }}
                  style={{ marginTop: '1rem' }}
                >
                  Change Signatories
                </Button>
              </div>
            </div>
          </div>
        )}
      </HeaderFooterModal>

      <ConfirmationModal
        isOpen={showApprovalConfirmation}
        onClose={() => setShowApprovalConfirmation(false)}
        type="success"
        title="Success"
        message={approvalConfirmMessage}
        confirmText="Done"
        onConfirm={() => setShowApprovalConfirmation(false)}
      />

      <HeaderFooterModal
        isOpen={showReviewModal && !!reviewSitRep}
        onClose={() => setShowReviewModal(false)}
        title={`Review: ${reviewSitRep?.title}`}
        subtitle="Review the signed PDF below, then Approve or Reject it."
        maxWidth="1200px"
        footer={
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', width: '100%' }}>
            <Button
              variant="subtle"
              onClick={() => setShowReviewModal(false)}
              disabled={processingReview}
            >
              Cancel
            </Button>

            {!showRejectInput ? (
              <Button
                variant="outline"
                color="danger"
                onClick={() => setShowRejectInput(true)}
                disabled={processingReview}
                icon={<X size={14} />}
              >
                Reject
              </Button>
            ) : (
              <Button
                variant="solid"
                color="danger"
                onClick={handleRejectConfirm}
                isLoading={processingReview}
                disabled={!rejectRemarks.trim()}
              >
                Confirm Rejection
              </Button>
            )}

            <Button
              variant="solid"
              color="primary"
              onClick={handleApproveConfirm}
              isLoading={processingReview}
              icon={<CheckCircle size={14} />}
            >
              Approve
            </Button>
          </div>
        }
      >
        {reviewSitRep && (
          <div style={{ display: 'flex', height: '70vh', gap: '1.5rem', minHeight: 0 }}>
            {/* LEFT: PDF Viewer */}
            <div style={{ 
              flex: showPdfPreview ? 1.5 : 0, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem', 
              minWidth: 0,
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              opacity: showPdfPreview ? 1 : 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={16} style={{ color: '#64748b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#334155' }}>PDF Document</span>
              </div>
              <div style={{ flex: 1, background: '#e2e8f0', overflow: 'hidden', minHeight: 0, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {(reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url) ? (
                  <iframe
                    src={reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url}
                    title="Situational Report PDF"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: '0.5rem' }}>
                    <FileText size={40} />
                    <p>No PDF uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* MIDDLE: Toggle Handle */}
            <div 
              onClick={() => setShowPdfPreview(!showPdfPreview)}
              style={{
                width: '12px',
                height: '100%',
                background: '#f1f5f9',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: '1px solid #e2e8f0'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
              title={showPdfPreview ? "Hide PDF Preview" : "Show PDF Preview"}
            >
              <div style={{ color: '#64748b' }}>
                {showPdfPreview ? <CaretDown size={12} style={{ transform: 'rotate(90deg)' }} /> : <CaretDown size={12} style={{ transform: 'rotate(-90deg)' }} />}
              </div>
            </div>

            {/* RIGHT: Status & Remarks */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
              <div className="signatories-card-modern" style={{ marginTop: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Report Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`status-pill status-${(reviewSitRep.status || 'draft').toLowerCase().replace(/\s+/g, '-')}`}>
                    {reviewSitRep.status}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Created by {reviewSitRep.creator_name || reviewSitRep.creator_city || 'System'}
                  </span>
                </div>
              </div>

              {/* Reject remarks (shown when reject clicked) */}
              {showRejectInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#be123c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Warning size={16} />
                    Rejection Remarks <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={rejectRemarks}
                    onChange={e => setRejectRemarks(e.target.value)}
                    placeholder="Please explain why this report is being rejected..."
                    rows={6}
                    style={{
                      width: '100%', padding: '0.75rem', border: '1.5px solid #fca5a5', borderRadius: '0.5rem',
                      fontSize: '0.875rem', resize: 'none', outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit', background: '#fff'
                    }}
                    autoFocus
                  />
                  <p style={{ fontSize: '0.75rem', color: '#991b1b', margin: 0 }}>The creator will be notified and asked to revise the report based on these remarks.</p>
                </div>
              )}

              {!showRejectInput && reviewSitRep.rejection_remarks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Previous Rejection Remarks</span>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>{reviewSitRep.rejection_remarks}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </HeaderFooterModal>

      <ConfirmationModal
        isOpen={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        type="warning"
        title="Regenerate AI Summary"
        message="Are you sure you want to regenerate the AI summary? Your current unsaved edits will be lost, but you can still access previous versions from the history dropdown."
        confirmText="Yes, Regenerate"
        onConfirm={handleRegenerateAISummary}
      />
    </div>
  )
}