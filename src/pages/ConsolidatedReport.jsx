import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext, Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronUp, ArrowLeft, Download, FileText, FileDown, FileBarChart, Edit3, Trash2, Eye, Plus, X, CheckCircle, Check, Upload, Calendar, Clock, Send, ExternalLink, Sparkles, RefreshCw, Users } from 'lucide-react'
import SearchInput from '../components/SearchInput'
import SearchableSelect from '../components/SearchableSelect'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import { supabase, supabaseUrl } from '../lib/supabase'
import { generateRelatedIncidentsPdf } from '../lib/generateRelatedIncidentsPdf'
import { LGU_NAMES, getBarangaysForCity, getCityForBarangay } from '../data/locations'
import { getCitiesForProvince, PROVINCES_WITH_CITIES, PROVINCE_NAMES } from '../data/provinces'
import { useEvents } from '../contexts/EventContext'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import { generateConsolidatedCsv } from '../lib/generateConsolidatedCsv'
import { generateAISummary } from '../openai/summaryService'
import '../styles/pages/PageStyles.css'
import '../styles/pages/ConsolidatedReport.css'

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
  assistanceLgus: 'Assistance from LGUs/Agencies',
  agricultureDamage: 'Agriculture Damage',
  infrastructureDamage: 'Infrastructure Damage',
}

const CATEGORY_ORDER = [
  'affectedPopulation',
  'relatedIncidents',
  'roadsAndBridges',
  'power',
  'waterSupply',
  'communicationLines',
  'damagedHouses',
  'classSuspension',
  'workSuspension',
  'stateOfCalamity',
  'preEmptiveEvacuation',
  'assistanceProvided',
  'assistanceLgus',
  'agricultureDamage',
  'infrastructureDamage',
]

const PAGE_SIZES = [10, 25, 50]

function addToCityCounts(city, category, totalByCity, byCityCategory) {
  if (!city) return
  totalByCity[city] = (totalByCity[city] || 0) + 1
  if (!byCityCategory[city]) byCityCategory[city] = {}
  byCityCategory[city][category] = (byCityCategory[city][category] || 0) + 1
}

const CATEGORY_TO_TABLE = {
  affectedPopulation: 'reports',
  relatedIncidents: 'related_incidents',
  roadsAndBridges: 'roads_and_bridges',
  power: 'power_reports',
  waterSupply: 'water_supply_reports',
  communicationLines: 'communication_lines_reports',
  damagedHouses: 'damaged_houses_reports',
  classSuspension: 'class_suspension_reports',
  workSuspension: 'work_suspension_reports',
  stateOfCalamity: 'declaration_state_of_calamity_reports',
  preEmptiveEvacuation: 'pre_emptive_evacuation_reports',
  assistanceProvided: 'assistance_provided_reports',
  assistanceLgus: 'assistance_lgus_agencies_reports',
  agricultureDamage: 'agriculture_damage_reports',
  infrastructureDamage: 'infrastructure_damage_reports',
}

export default function ConsolidatedReport() {
  const { user } = useOutletContext() ?? {}
  const { events, loading: eventsLoading, showSuccess, showConfirm, fetchSituationalReports, sendSituationalReport, notifications, markSitRepNotificationsAsRead } = useEvents()

  const unreadNotifs = useMemo(() => notifications?.filter(n => !n.is_read) || [], [notifications])

  const hasUnread = useCallback((eventId, sitrepId = null) => {
    return unreadNotifs.some(n => {
      let data = n.data
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (e) { data = {} }
      }
      if (sitrepId) return String(data?.sitrep_id) === String(sitrepId)
      return String(data?.event_id) === String(eventId)
    })
  }, [unreadNotifs])

  const isProvincial = user?.account_type === 'Provincial'
  const isProvincialApprover = user?.account_type === 'Provincial Approver'
  const isRegional = user?.account_type === 'Regional'
  const isSuperAdmin = user?.account_type === 'Super Admin' || user?.role === 'Super Admin'
  const isAllowed = isProvincial || isProvincialApprover || isRegional || isSuperAdmin

  const location = useLocation()

  const province = user?.province || (isSuperAdmin ? 'Region 1' : '')
  const provinceCities = isSuperAdmin
    ? Object.values(PROVINCES_WITH_CITIES).flat()
    : getCitiesForProvince(province)

  const [processingId, setProcessingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('startDate')
  const [sortAsc, setSortAsc] = useState(false)
  const [activeEventIds, setActiveEventIds] = useState(null)
  const [pendingEventIds, setPendingEventIds] = useState(null)
  const [approvedEventIds, setApprovedEventIds] = useState(null)
  const [statusFilter, setStatusFilter] = useState(new URLSearchParams(location.search).get('status') || 'all')
  const [loadingActive, setLoadingActive] = useState(false)

  // Approval State
  const [showApprovalUploadModal, setShowApprovalUploadModal] = useState(false) // Provincial uploads PDF

  const [approvalFile, setApprovalFile] = useState(null)
  const [uploadingApproval, setUploadingApproval] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [showApprovalConfirmation, setShowApprovalConfirmation] = useState(false)
  const [approvalConfirmMessage, setApprovalConfirmMessage] = useState('The signed PDF has been uploaded and is pending approval.')
  const [showApprovedView, setShowApprovedView] = useState(false)
  const [approvedViewEvent, setApprovedViewEvent] = useState(null)
  const [localApprovalMap, setLocalApprovalMap] = useState({})

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Sit Rep Versions Modal State
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [versionsEvent, setVersionsEvent] = useState(null)
  const [sitRepVersions, setSitRepVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // LGU Status Modal State
  const [showLguStatusModal, setShowLguStatusModal] = useState(false)
  const [lguStatusEvent, setLguStatusEvent] = useState(null)
  const [lguStatusVersion, setLguStatusVersion] = useState(null)
  const [lguStatusData, setLguStatusData] = useState({ submitted: [], pending: [] })
  const [lguStatusLoading, setLguStatusLoading] = useState(false)

  // --- NEW: Multi-level Navigation State ---
  const [view, setView] = useState('events') // 'events', 'sitreps', 'provinces', 'categories', 'lgus', 'details'
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedSitRep, setSelectedSitRep] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedLgu, setSelectedLgu] = useState(null)
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [categoryData, setCategoryData] = useState(null) // Consolidated data for SitRep
  const [lguDetailRows, setLguDetailRows] = useState([]) // Data rows for Level 5
  const [deletedRowIds, setDeletedRowIds] = useState([]) // IDs to delete from DB
  const [drillDownLoading, setDrillDownLoading] = useState(false)
  const [submittingDetails, setSubmittingDetails] = useState(false)


  // Remarks Editor State
  const [showTextEditorModal, setShowTextEditorModal] = useState(false)
  const [textEditorModalData, setTextEditorModalData] = useState(null)

  const openTextEditorModal = (index, field, value, title) => {
    setTextEditorModalData({ rowIndex: index, field, value, tempValue: value || '', title: title || 'Edit Text' })
    setShowTextEditorModal(true)
  }

  const saveTextUpdate = () => {
    if (textEditorModalData) {
      handleRowChange(textEditorModalData.rowIndex, textEditorModalData.field, textEditorModalData.tempValue)
    }
    setShowTextEditorModal(false)
    setTextEditorModalData(null)
  }

  const handleRowChange = (index, field, value) => {
    setLguDetailRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleDateTimeChange = (index, dateField, timeField, value) => {
    if (!value) {
      handleRowChange(index, dateField, '')
      handleRowChange(index, timeField, '')
      return
    }
    const [datePart, timePart] = value.split('T')
    handleRowChange(index, dateField, datePart)
    handleRowChange(index, timeField, timePart + ':00')
  }

  const handleAddRow = () => {
    const newRow = {
      barangay: '',
      city: selectedLgu || '',
      event_id: selectedEvent?.id,
      situational_report_id: selectedSitRep?.id,
      // Default values for various fields across categories
      status: 'Ongoing',
      remarks: ''
    }
    setLguDetailRows((prev) => [...prev, newRow])
  }

  const handleDeleteRow = (index) => {
    const rowToDelete = lguDetailRows[index]
    if (rowToDelete?.id) {
      setDeletedRowIds((prev) => [...prev, rowToDelete.id])
    }
    setLguDetailRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmitDetails = async () => {
    if (!supabase || !selectedCategory || !selectedEvent || !selectedSitRep) return
    const tableName = CATEGORY_TO_TABLE[selectedCategory]
    if (!tableName) return

    setSubmittingDetails(true)
    try {
      // 1. Handle Deletions
      if (deletedRowIds.length > 0) {
        const { error: delErr } = await supabase
          .from(tableName === 'reports' ? 'report_rows' : tableName) // affectedPopulation uses report_rows
          .delete()
          .in('id', deletedRowIds)
        if (delErr) throw delErr
      }

      // 2. Handle Upserts
      // For 'affectedPopulation', we need to handle report_id and report_rows separately
      if (selectedCategory === 'affectedPopulation') {
        const { data: reports } = await supabase
          .from('reports')
          .select('id')
          .eq('event_id', selectedEvent.id)
          .eq('situational_report_id', selectedSitRep.id)
          .limit(1)
        
        let reportId
        if (reports?.length) {
          reportId = reports[0].id
        } else {
          const { data: newReport, error: repErr } = await supabase
            .from('reports')
            .insert({ event_id: selectedEvent.id, situational_report_id: selectedSitRep.id })
            .select('id')
            .single()
          if (repErr) throw repErr
          reportId = newReport.id
        }

        const toInsert = lguDetailRows.filter(r => !r.id).map(row => {
          const { id, city: _, ...rest } = row
          return { ...rest, report_id: reportId }
        })
        const toUpdate = lguDetailRows.filter(r => r.id).map(row => {
          const { city: _, ...rest } = row
          return { ...rest, report_id: reportId }
        })

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from('report_rows').insert(toInsert)
          if (insErr) throw insErr
        }
        if (toUpdate.length > 0) {
          const { error: updErr } = await supabase.from('report_rows').upsert(toUpdate, { onConflict: 'id' })
          if (updErr) throw updErr
        }

      } else {
        const toInsert = lguDetailRows.filter(r => !r.id).map(row => {
          const { id, ...rest } = row
          return { 
            ...rest, 
            event_id: selectedEvent.id, 
            situational_report_id: selectedSitRep.id 
          }
        })
        const toUpdate = lguDetailRows.filter(r => r.id).map(row => {
          const { ...rest } = row
          return { 
            ...rest, 
            event_id: selectedEvent.id, 
            situational_report_id: selectedSitRep.id 
          }
        })

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from(tableName).insert(toInsert)
          if (insErr) throw insErr
        }
        if (toUpdate.length > 0) {
          const { error: updErr } = await supabase.from(tableName).upsert(toUpdate, { onConflict: 'id' })
          if (updErr) throw updErr
        }
      }

      showSuccess('Success', 'Report details updated successfully.')
      setDeletedRowIds([]) // Clear deletions
      handleBack() // return to LGUs list
    } catch (err) {
      console.error('Submit details error:', err)
      alert('Error saving changes: ' + err.message)
    } finally {
      setSubmittingDetails(false)
    }
  }

  const navigateTo = (newView, data = {}) => {
    setView(newView)
    if (data.event !== undefined) setSelectedEvent(data.event)
    if (data.sitrep !== undefined) setSelectedSitRep(data.sitrep)
    if (data.category !== undefined) setSelectedCategory(data.category)
    if (data.lgu !== undefined) setSelectedLgu(data.lgu)
    if (data.province !== undefined) setSelectedProvince(data.province)

    if (newView === 'events') {
      setSelectedEvent(null)
      setSelectedSitRep(null)
      setSelectedCategory(null)
      setSelectedLgu(null)
      setSelectedProvince(null)
    } else if (newView === 'sitreps') {
      setSelectedSitRep(null)
      setSelectedCategory(null)
      setSelectedLgu(null)
      setSelectedProvince(null)
    } else if (newView === 'provinces') {
      setSelectedCategory(null)
      setSelectedLgu(null)
      setSelectedProvince(null)
    } else if (newView === 'categories') {
      setSelectedCategory(null)
      if (!selectedLgu) setSelectedLgu(null)
    } else if (newView === 'lgus') {
      setSelectedLgu(null)
    }

    setCurrentPage(1)
    setSearchTerm('')
  }
  // ------------------------------------------

  const handleBack = () => {
    switch (view) {
      case 'sitreps':
        navigateTo('events')
        break
      case 'provinces':
        navigateTo('sitreps')
        break
      case 'categories':
        if (selectedLgu && isRegional) {
          navigateTo('lgus')
        } else {
          navigateTo('sitreps')
        }
        break
      case 'lgus':
        if (selectedProvince) {
          navigateTo('provinces')
        } else {
          navigateTo('categories')
        }
        break
      case 'details':
        navigateTo(isRegional ? 'categories' : 'lgus')
        break
      default:
        break
    }
  }

  const [showSignatoriesModal, setShowSignatoriesModal] = useState(false)
  const [showDownloadTypeModal, setShowDownloadTypeModal] = useState(false)
  const [showPdfEditModal, setShowPdfEditModal] = useState(false)
  const [generatedSummaryData, setGeneratedSummaryData] = useState(null)
  const [aiGeneratedSummaryText, setAiGeneratedSummaryText] = useState('')
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState(null)
  const [availableSignatories, setAvailableSignatories] = useState([])
  const [signatorySearch, setSignatorySearch] = useState('')
  const [preparedBy, setPreparedBy] = useState([])       // array of signatories
  const [notedBy, setNotedBy] = useState(null)           // single signatory
  const [approvedBy, setApprovedBy] = useState(null)     // single signatory
  const [signatoryRole, setSignatoryRole] = useState('preparedBy') // which section is being picked

  const fetchSignatories = async () => {
    let query = supabase.from('users').select('id, first_name, last_name, email, province, account_type, status')
    if (!isSuperAdmin && !isRegional && province) {
      query = query.eq('province', province)
    } else if (isRegional && province) {
      query = query.eq('province', province)
    }
    const { data, error } = await query.eq('status', 'Active').order('last_name', { ascending: true })
    if (!error && data) {
      const mapped = data.map(u => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        account_type: u.account_type,
        province: u.province
      }))
      setAvailableSignatories(mapped)
      // Auto-populate based on role
      const provincialUsers = mapped.filter(u => u.account_type === 'Provincial')
      const approverUsers = mapped.filter(u => u.account_type === 'Provincial Approver')
      if (provincialUsers.length > 0) {
        setPreparedBy(provincialUsers.slice(0, 1))
        if (provincialUsers.length > 1) setNotedBy(provincialUsers[1])
      }
      if (approverUsers.length > 0) setApprovedBy(approverUsers[0])
    }
  }

  const generatePdfBlobUrl = (pdfParams, summaryOverride, sigs) => {
    try {
      const doc = generateRelatedIncidentsPdf({
        ...pdfParams,
        summaryText: summaryOverride,
        signatories: sigs || { preparedBy, notedBy, approvedBy }
      })
      const blob = doc.output('blob')
      return URL.createObjectURL(blob)
    } catch (e) {
      console.error('PDF preview error', e)
      return null
    }
  }

  const handleConfirmDownload = () => {
    if (!generatedSummaryData) return
    const finalDoc = generateRelatedIncidentsPdf({
      ...generatedSummaryData.pdfParams,
      summaryText: aiGeneratedSummaryText,
      signatories: { preparedBy, notedBy, approvedBy }
    })
    const fileName = `${(generatedSummaryData.pdfParams.reportTitle || 'Report').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    finalDoc.save(fileName)
    setShowPdfEditModal(false)
  }

  const handleConsolidatedDownloadClick = async (prov = null, lgu = null, mode = 'both') => {
    // If we're looking at a specific provincial SITREP and it has an approved PDF,
    // and we're not explicitly asking for CSV, use the uploaded PDF directly.
    if (selectedSitRep?.approved_pdf_url && mode !== 'csv') {
      handleSitRepDownloadClick(selectedSitRep)
      return
    }

    // mode: 'pdf', 'csv', or 'both' (default)
    const targetProvince = prov || selectedProvince
    const targetLgu = lgu || selectedLgu
    
    setDrillDownLoading(true)
    try {
      const data = await fetchEventConsolidatedData(selectedEvent, null)
      if (!data) return

      let scopedByCityCategory = { ...data.byCityCategory }
      let scopedDetails = { ...data.details }
      let reportTitle = `Consolidated Report - ${selectedEvent.name}`

      // 1. Filter by Province
      if (targetProvince && !targetLgu) {
        const provinceCities = getCitiesForProvince(targetProvince)
        const citySet = new Set(provinceCities.map(c => c.toLowerCase()))
        
        scopedByCityCategory = {}
        Object.entries(data.byCityCategory).forEach(([city, cats]) => {
          if (citySet.has(city.toLowerCase())) {
            scopedByCityCategory[city] = cats
          }
        })

        // Filter details
        Object.keys(scopedDetails).forEach(key => {
          if (Array.isArray(scopedDetails[key])) {
            scopedDetails[key] = scopedDetails[key].filter(row => {
              const city = row.city || getCityForBarangay(row.barangay)
              return city && citySet.has(city.toLowerCase())
            })
          }
        })
        reportTitle = `Consolidated Report - ${targetProvince}`
      }

      // 2. Filter by LGU
      if (targetLgu) {
        scopedByCityCategory = { [targetLgu]: data.byCityCategory[targetLgu] || {} }
        Object.keys(scopedDetails).forEach(key => {
          if (Array.isArray(scopedDetails[key])) {
            scopedDetails[key] = scopedDetails[key].filter(row => {
              const city = row.city || getCityForBarangay(row.barangay)
              return city && city.toLowerCase() === targetLgu.toLowerCase()
            })
          }
        })
        reportTitle = `Consolidated Report - ${targetLgu}`
      }

      // 3. Re-calculate Category Totals for the scope
      const scopedCategoryTotals = {}
      Object.values(scopedByCityCategory).forEach(cityCats => {
        Object.entries(cityCats).forEach(([cat, val]) => {
          if (typeof val === 'number') {
            scopedCategoryTotals[cat] = (scopedCategoryTotals[cat] || 0) + val
          } else if (typeof val === 'object' && val !== null) {
            if (!scopedCategoryTotals[cat]) scopedCategoryTotals[cat] = { families: 0, persons: 0, total: 0 }
            scopedCategoryTotals[cat].families += (val.families || 0)
            scopedCategoryTotals[cat].persons += (val.persons || 0)
            scopedCategoryTotals[cat].total += (val.total || 0)
          }
        })
      })

      const pdfParams = {
        province: targetProvince || (targetLgu ? getProvinceForCity(targetLgu) : province) || 'Region 1',
        eventName: selectedEvent.name,
        reportTitle: reportTitle,
        cities: Object.keys(scopedByCityCategory).sort(),
        categoryTotals: scopedCategoryTotals,
        byCityCategory: scopedByCityCategory,
        affectedPopulationDetails: scopedDetails.affectedPopulation,
        relatedIncidentsDetails: scopedDetails.relatedIncidents,
        roadsAndBridgesDetails: scopedDetails.roadsAndBridges,
        powerDetails: scopedDetails.power,
        waterSupplyDetails: scopedDetails.waterSupply,
        communicationLinesDetails: scopedDetails.communicationLines,
        damagedHousesDetails: scopedDetails.damagedHouses,
        classSuspensionDetails: scopedDetails.classSuspension,
        workSuspensionDetails: scopedDetails.workSuspension,
        stateOfCalamityDetails: scopedDetails.stateOfCalamity,
        preEmptiveEvacuationDetails: scopedDetails.preEmptiveEvacuation,
        assistanceProvidedDetails: scopedDetails.assistanceProvided,
        assistanceLgusDetails: scopedDetails.assistanceLgus,
        agricultureDamageDetails: scopedDetails.agricultureDamage,
        infrastructureDamageDetails: scopedDetails.infrastructureDamage,
      }

      setGeneratedSummaryData({ pdfParams })
      setAiGeneratedSummaryText('Generating summary...')
      
      // Update preview immediately with placeholder
      const initialUrl = generatePdfBlobUrl(pdfParams, 'Generating AI Summary...', { preparedBy: [], notedBy: null, approvedBy: null })
      setPdfPreviewBlobUrl(initialUrl)

      // Background AI generation
      generateAISummary({ categoryTotals: scopedCategoryTotals, byCityCategory: scopedByCityCategory, details: scopedDetails }, selectedEvent, [])
        .then(text => {
          if (text) {
            setAiGeneratedSummaryText(text)
            const newUrl = generatePdfBlobUrl(pdfParams, text, { preparedBy: [], notedBy: null, approvedBy: null })
            setPdfPreviewBlobUrl(newUrl)
          }
        })
        .catch(err => {
          console.error('Consolidated AI Summary Error:', err)
          setAiGeneratedSummaryText('AI Summary Unavailable.')
        })

      fetchSignatories()
      
      if (mode === 'pdf') {
        setShowPdfEditModal(true)
      } else if (mode === 'csv') {
        generateConsolidatedCsv({
          ...pdfParams,
          summaryText: 'Summary generated for CSV export',
          signatories: { preparedBy: [], notedBy: null, approvedBy: null }
        })
      } else {
        setShowDownloadTypeModal(true)
      }
    } catch (err) {
      console.error('Consolidated Download Error:', err)
    } finally {
      setDrillDownLoading(false)
    }
  }

  const handleSitRepDownloadClick = async (sitrep) => {
    // If a signed PDF is already uploaded and approved, download it directly
    if (sitrep.approved_pdf_url) {
      setProcessingId(sitrep.id)
      try {
        const link = document.createElement('a')
        link.href = sitrep.approved_pdf_url
        // Use the title as filename, replace spaces with hyphens
        const fileName = `${sitrep.title.replace(/\s+/g, '-')}_Signed.pdf`
        link.setAttribute('download', fileName)
        link.setAttribute('target', '_blank')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return
      } catch (err) {
        console.error('Direct download failed:', err)
      } finally {
        setProcessingId(null)
      }
    }

    setProcessingId(sitrep.id)
    try {
      const data = await fetchEventConsolidatedData(selectedEvent, sitrep.id)
      if (!data) return
      
      const pdfParams = {
        province: province || 'Region 1',
        eventName: selectedEvent.name,
        reportTitle: sitrep.title,
        cities: Object.keys(data.byCityCategory || {}).sort(),
        categoryTotals: data.categoryTotals,
        byCityCategory: data.byCityCategory,
        affectedPopulationDetails: data.details.affectedPopulation,
        relatedIncidentsDetails: data.details.relatedIncidents,
        roadsAndBridgesDetails: data.details.details_roads_and_bridges || data.details.roadsAndBridges,
        powerDetails: data.details.power,
        waterSupplyDetails: data.details.waterSupply,
        communicationLinesDetails: data.details.communicationLines,
        damagedHousesDetails: data.details.damagedHouses,
        classSuspensionDetails: data.details.classSuspension,
        workSuspensionDetails: data.details.workSuspension,
        stateOfCalamityDetails: data.details.stateOfCalamity,
        preEmptiveEvacuationDetails: data.details.preEmptiveEvacuation,
        assistanceProvidedDetails: data.details.assistanceProvided,
        assistanceLgusDetails: data.details.assistanceLgus,
        agricultureDamageDetails: data.details.agricultureDamage,
        infrastructureDamageDetails: data.details.infrastructureDamage,
      }

      const summaryPlaceholder = sitrep.summary || 'Generating AI Summary... Please wait.'
      setAiGeneratedSummaryText(summaryPlaceholder)
      setGeneratedSummaryData({ pdfParams })
      
      // Update preview immediately
      const initialUrl = generatePdfBlobUrl(pdfParams, summaryPlaceholder, { preparedBy: [], notedBy: null, approvedBy: null })
      setPdfPreviewBlobUrl(initialUrl)
      
      // Background AI generation
      if (!sitrep.summary) {
        generateAISummary(data, selectedEvent, [])
          .then(text => {
            if (text) {
              setAiGeneratedSummaryText(text)
              const newUrl = generatePdfBlobUrl(pdfParams, text, { preparedBy: [], notedBy: null, approvedBy: null })
              setPdfPreviewBlobUrl(newUrl)
            }
          })
          .catch(err => {
            console.error('Background AI summary failed:', err)
            setAiGeneratedSummaryText('AI summary unavailable.')
          })
      }

      fetchSignatories()
      setShowPdfEditModal(true)
    } finally {
      setProcessingId(null)
    }
  }

  const fetchLguCategoryDetails = async (eventId, sitRepId, category, city) => {
    if (!supabase) return []
    setDeletedRowIds([]) // Reset deletions when picking a new LGU
    const tableName = CATEGORY_TO_TABLE[category]
    if (!tableName) return []

    try {
      if (category === 'affectedPopulation') {
        const { data: reports } = await supabase
          .from('reports')
          .select('id')
          .eq('event_id', eventId)
          .eq('situational_report_id', sitRepId)
        
        if (!reports?.length) return []
        
        const { data: rows } = await supabase
          .from('report_rows')
          .select('*')
          .in('report_id', reports.map(r => r.id))
        
        return (rows || []).map(r => ({
          ...r,
          city: city // Ensure city is attached
        })).filter(r => getCityForBarangay(r.barangay) === city)
      } else {
        const { data } = await supabase
          .from(tableName)
          .select('*')
          .eq('event_id', eventId)
          .eq('situational_report_id', sitRepId)
        
        return (data || []).map(r => ({
          ...r,
          city: r.city || getCityForBarangay(r.barangay) || (category === 'waterSupply' ? 'N/A' : null)
        })).filter(r => r.city === city)
      }
    } catch (err) {
      console.error('Fetch LGU details error:', err)
      return []
    }
  }

  const renderDetailsHeader = (category) => {
    switch (category) {
      case 'affectedPopulation':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Families</th>
            <th>Persons</th>
            <th>Evac Centers</th>
            <th>Inside Families</th>
            <th>Inside Persons</th>
            <th>Outside Families</th>
            <th>Outside Persons</th>
          </tr>
        )
      case 'relatedIncidents':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Incident Type</th>
            <th>Date/Time</th>
            <th>Status</th>
            <th>Description</th>
          </tr>
        )
      case 'roadsAndBridges':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Name</th>
            <th>Classification</th>
            <th>Status</th>
            <th>Date Reported</th>
          </tr>
        )
      case 'power':
      case 'communicationLines':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Interruption Date</th>
            <th>Restoration Date</th>
          </tr>
        )
      case 'damagedHouses':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Totally</th>
            <th>Partially</th>
            <th>Total</th>
            <th>Amount</th>
          </tr>
        )
      case 'classSuspension':
      case 'workSuspension':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Level/Type</th>
            <th>Suspension Date</th>
            <th>Resumption Date</th>
          </tr>
        )
      case 'assistanceProvided':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Assisted Families</th>
            <th>Qty/Unit</th>
            <th>Amount</th>
            <th>Source</th>
          </tr>
        )
      case 'waterSupply':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Service Provider</th>
            <th>Status</th>
            <th>Interruption Date</th>
            <th>Restoration Date</th>
          </tr>
        )
      case 'stateOfCalamity':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Resolution No.</th>
            <th>Date of Declaration</th>
            <th>Remarks</th>
          </tr>
        )
      case 'preEmptiveEvacuation':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Families</th>
            <th>Persons</th>
            <th>Remarks</th>
          </tr>
        )
      case 'assistanceLgus':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Source</th>
            <th>Relief Type</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Cost/Unit</th>
            <th>Amount</th>
            <th>Status</th>
            <th className="col-remarks">Remarks</th>
            <th className="col-actions">Actions</th>
          </tr>
        )
      case 'agricultureDamage':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Classification</th>
            <th>Commodity/Type</th>
            <th>Farmers Affected</th>
            <th>Area Total (ha)</th>
            <th>Volume Loss</th>
            <th>Value Loss</th>
            <th className="col-remarks">Remarks</th>
          </tr>
        )
      case 'infrastructureDamage':
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Infra Type</th>
            <th>Infrastructure Name</th>
            <th>Damage Description</th>
            <th>Estimated Cost</th>
            <th className="col-remarks">Remarks</th>
          </tr>
        )
      default:
        return (
          <tr>

            <th className="col-barangay">Barangay</th>
            <th>Summary</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        )
    }
  }

  const renderDetailsRow = (category, row, idx) => {
    const city = row.city || selectedLgu || 'N/A'
    switch (category) {
      case 'affectedPopulation':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input type="number" value={row.affected_families || 0} onChange={(e) => handleRowChange(idx, 'affected_families', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.affected_persons || 0} onChange={(e) => handleRowChange(idx, 'affected_persons', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.ecs_now || 0} onChange={(e) => handleRowChange(idx, 'ecs_now', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.inside_families_now || 0} onChange={(e) => handleRowChange(idx, 'inside_families_now', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.inside_persons_now || 0} onChange={(e) => handleRowChange(idx, 'inside_persons_now', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.outside_families_now || 0} onChange={(e) => handleRowChange(idx, 'outside_families_now', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.outside_persons_now || 0} onChange={(e) => handleRowChange(idx, 'outside_persons_now', parseInt(e.target.value) || 0)} /></td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'relatedIncidents':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.type_of_incident} onChange={(e) => handleRowChange(idx, 'type_of_incident', e.target.value)} /></td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_of_occurrence && row.time_of_occurrence ? `${row.date_of_occurrence}T${row.time_of_occurrence.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_of_occurrence', 'time_of_occurrence', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td>
              <SearchableSelect
                options={['Ongoing', 'Resolved'].map(s => ({ value: s, label: s }))}
                value={row.status}
                onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'description', row.description, 'Edit Description')}
              >
                {row.description || <span className="placeholder">Add description...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'roadsAndBridges':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.road_bridge_name} onChange={(e) => handleRowChange(idx, 'road_bridge_name', e.target.value)} /></td>
            <td>
              <SearchableSelect
                options={['National', 'Provincial', 'Municipal', 'Barangay'].map(c => ({ value: c, label: c }))}
                value={row.classification}
                onChange={(e) => handleRowChange(idx, 'classification', e.target.value)}
                placeholder="Classification"
              />
            </td>
            <td>
              <SearchableSelect
                options={['Passable', 'Not Passable', 'Passable to light vehicles only'].map(s => ({ value: s, label: s }))}
                value={row.status}
                onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_not_passable && row.time_not_passable ? `${row.date_not_passable}T${row.time_not_passable.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_not_passable', 'time_not_passable', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'power':
      case 'communicationLines':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.service_provider || row.telecompany} onChange={(e) => handleRowChange(idx, row.service_provider !== undefined ? 'service_provider' : 'telecompany', e.target.value)} /></td>
            <td>
              <SearchableSelect
                options={['Ongoing', 'Restored', 'Interrupted'].map(s => ({ value: s, label: s }))}
                value={row.status || row.status_of_communication}
                onChange={(e) => handleRowChange(idx, row.status !== undefined ? 'status' : 'status_of_communication', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_interruption && row.time_interruption ? `${row.date_interruption}T${row.time_interruption.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_interruption', 'time_interruption', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_restored && row.time_restored ? `${row.date_restored}T${row.time_restored.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_restored', 'time_restored', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'damagedHouses':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input type="number" value={row.totally_damaged || 0} onChange={(e) => handleRowChange(idx, 'totally_damaged', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.partially_damaged || 0} onChange={(e) => handleRowChange(idx, 'partially_damaged', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={(Number(row.totally_damaged || 0) + Number(row.partially_damaged || 0))} readOnly style={{ fontWeight: 600 }} /></td>
            <td><input type="number" value={row.amount_php || 0} onChange={(e) => handleRowChange(idx, 'amount_php', parseInt(e.target.value) || 0)} /></td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'classSuspension':
      case 'workSuspension':
        const levelField = category === 'classSuspension' ? 'level' : 'office_level'
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row[levelField] || row.type_of_suspension} onChange={(e) => handleRowChange(idx, row[levelField] !== undefined ? levelField : 'type_of_suspension', e.target.value)} /></td>
            <td>
              <input
                type="datetime-local"
                className="modern-datetime-picker"
                value={row.date_of_suspension && row.time_of_suspension ? `${row.date_of_suspension}T${row.time_of_suspension.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_of_suspension', 'time_of_suspension', e.target.value)}
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_of_resumption && row.time_of_resumption ? `${row.date_of_resumption}T${row.time_of_resumption.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_of_resumption', 'time_of_resumption', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'assistanceProvided':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input type="number" value={row.no_families_assisted || 0} onChange={(e) => handleRowChange(idx, 'no_families_assisted', parseInt(e.target.value) || 0)} /></td>
            <td><input value={`${row.fnfi_qty || ''} ${row.fnfi_unit || ''}`} onChange={(e) => {
               const [q, u] = e.target.value.split(' ')
               handleRowChange(idx, 'fnfi_qty', q)
               handleRowChange(idx, 'fnfi_unit', u)
            }} /></td>
            <td><input type="number" value={row.fnfi_amount || 0} onChange={(e) => handleRowChange(idx, 'fnfi_amount', parseInt(e.target.value) || 0)} /></td>
            <td><input value={row.fnfi_source || row.source} onChange={(e) => handleRowChange(idx, row.fnfi_source !== undefined ? 'fnfi_source' : 'source', e.target.value)} /></td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'waterSupply':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay || 'N/A'}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.service_provider} onChange={(e) => handleRowChange(idx, 'service_provider', e.target.value)} /></td>
            <td>
              <SearchableSelect
                options={['Ongoing', 'Restored', 'Interrupted'].map(s => ({ value: s, label: s }))}
                value={row.status}
                onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_of_interruption && row.time_of_interruption ? `${row.date_of_interruption}T${row.time_of_interruption.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_of_interruption', 'time_of_interruption', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td>
              <ModernDateTimePicker
                type="datetime-local"
                value={row.date_restored && row.time_restored ? `${row.date_restored}T${row.time_restored.substring(0, 5)}` : ''}
                onChange={(e) => handleDateTimeChange(idx, 'date_restored', 'time_restored', e.target.value)}
                placeholder="Select Date & Time"
              />
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'preEmptiveEvacuation':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input type="number" value={row.families || 0} onChange={(e) => handleRowChange(idx, 'families', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.persons || 0} onChange={(e) => handleRowChange(idx, 'persons', parseInt(e.target.value) || 0)} /></td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'stateOfCalamity':
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.resolution_number} onChange={(e) => handleRowChange(idx, 'resolution_number', e.target.value)} /></td>
            <td>
              <ModernDateTimePicker
                type="date"
                value={row.date_of_declaration || ''}
                onChange={(e) => handleRowChange(idx, 'date_of_declaration', e.target.value)}
                placeholder="Select Date"
              />
            </td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'assistanceLgus':
        return (
          <>
            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.source || row.source_of_assistance || ''} onChange={(e) => handleRowChange(idx, row.source_of_assistance !== undefined ? 'source_of_assistance' : 'source', e.target.value)} /></td>
            <td><input value={row.type || row.type_of_assistance || ''} onChange={(e) => handleRowChange(idx, row.type_of_assistance !== undefined ? 'type_of_assistance' : 'type', e.target.value)} /></td>
            <td><input type="number" value={row.qty ?? row.quantity ?? 0} onChange={(e) => handleRowChange(idx, row.quantity !== undefined ? 'quantity' : 'qty', parseInt(e.target.value) || 0)} /></td>
            <td><input value={row.unit || ''} onChange={(e) => handleRowChange(idx, 'unit', e.target.value)} /></td>
            <td><input type="number" value={row.cost_per_unit || row.costPerUnit || 0} onChange={(e) => handleRowChange(idx, row.cost_per_unit !== undefined ? 'cost_per_unit' : (row.costPerUnit !== undefined ? 'costPerUnit' : 'cost_per_unit'), parseFloat(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.amount || 0} onChange={(e) => handleRowChange(idx, 'amount', parseInt(e.target.value) || 0)} /></td>
            <td>
              <SearchableSelect
                options={['Ongoing', 'Distributed', 'Completed'].map(s => ({ value: s, label: s }))}
                value={row.status || 'Ongoing'}
                onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'agricultureDamage':
        return (
          <>
            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td>
              <SearchableSelect
                options={['Crop', 'Livestock', 'Fisheries', 'Other'].map(c => ({ value: c, label: c }))}
                value={row.classification}
                onChange={(e) => handleRowChange(idx, 'classification', e.target.value)}
                placeholder="Classification"
              />
            </td>
            <td><input value={row.type || row.crop_type || ''} onChange={(e) => handleRowChange(idx, row.crop_type !== undefined ? 'crop_type' : 'type', e.target.value)} /></td>
            <td><input type="number" value={row.farmers_affected || 0} onChange={(e) => handleRowChange(idx, 'farmers_affected', parseInt(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.area_affected || row.area_total || 0} onChange={(e) => handleRowChange(idx, row.area_total !== undefined ? 'area_total' : 'area_affected', parseFloat(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.volume_loss || 0} onChange={(e) => handleRowChange(idx, 'volume_loss', parseFloat(e.target.value) || 0)} /></td>
            <td><input type="number" value={row.value_loss || row.cost_of_damage || row.production_loss_value || 0} onChange={(e) => handleRowChange(idx, row.production_loss_value !== undefined ? 'production_loss_value' : (row.cost_of_damage !== undefined ? 'cost_of_damage' : 'value_loss'), parseInt(e.target.value) || 0)} /></td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      case 'infrastructureDamage':
        return (
          <>
            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.type || row.infra_type || ''} onChange={(e) => handleRowChange(idx, row.infra_type !== undefined ? 'infra_type' : 'type', e.target.value)} /></td>
            <td><input value={row.infrastructure_name || row.infra_name || ''} onChange={(e) => handleRowChange(idx, row.infra_name !== undefined ? 'infra_name' : 'infrastructure_name', e.target.value)} /></td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'damage_description', row.damage_description, 'Edit Damage Description')}
              >
                {row.damage_description || <span className="placeholder">Add description...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td><input type="number" value={row.cost || row.estimated_cost || 0} onChange={(e) => handleRowChange(idx, row.estimated_cost !== undefined ? 'estimated_cost' : 'cost', parseInt(e.target.value) || 0)} /></td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
      default:
        return (
          <>

            <td>
              <SearchableSelect
                options={getBarangaysForCity(row.city || city).map(b => ({ value: b, label: b }))}
                value={row.barangay || 'N/A'}
                onChange={(e) => handleRowChange(idx, 'barangay', e.target.value)}
                placeholder="Select Barangay"
              />
            </td>
            <td><input value={row.summary || row.description || row.type || 'N/A'} onChange={(e) => handleRowChange(idx, row.summary !== undefined ? 'summary' : (row.description !== undefined ? 'description' : 'type'), e.target.value)} /></td>
            <td>
              <SearchableSelect
                options={['Ongoing', 'Resolved', 'Restored'].map(s => ({ value: s, label: s }))}
                value={row.status || 'N/A'}
                onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                placeholder="Status"
              />
            </td>
            <td>
              <div 
                className="remarks-trigger" 
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <Edit3 size={14} />
              </div>
            </td>
            <td className="col-actions">
              <button type="button" className="btn-icon delete" onClick={() => handleDeleteRow(idx)} title="Delete Row">
                <Trash2 size={14} />
              </button>
            </td>
          </>
        )
    }
  }

  const handleExportCategoryCsv = async (category) => {
    if (!selectedSitRep || !selectedEvent) return
    setDrillDownLoading(true)
    try {
      const { data: allRows } = await supabase
        .from(CATEGORY_TO_TABLE[category])
        .select('*')
        .eq('event_id', selectedEvent.id)
        .eq('situational_report_id', selectedSitRep.id)
      
      if (!allRows?.length) {
        alert('No data to export for this category.')
        return
      }

      const headers = Object.keys(allRows[0]).join(',')
      const csv = [
        headers,
        ...allRows.map(row => Object.values(row).map(v => `"${v}"`).join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Consolidated_${CATEGORY_LABELS[category]}_${selectedEvent.name}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export CSV error:', err)
    } finally {
      setDrillDownLoading(false)
    }
  }

  useEffect(() => {
    if (showSignatoriesModal) fetchSignatories()
  }, [showSignatoriesModal])


  const APPROVAL_BUCKET = 'consolidated-report-approvals'

  // Helper: get approval status for an event (local override > context)
  const getApprovalStatus = (event) => {
    if (localApprovalMap[event.id]) return localApprovalMap[event.id].status || 'Pending'
    return event.approvalStatus || 'Pending'
  }

  const getApprovedPdfUrl = (event) => {
    if (localApprovalMap[event.id]?.url) return localApprovalMap[event.id].url
    return event.approvedPdfUrl || null
  }

  // Handle "Upload PDF" button click (Provincial user)
  const handleUploadPdfClick = (sitRep) => {
    setSelectedSitRep(sitRep)
    setApprovalFile(null)
    setShowApprovalUploadModal(true)
  }



  // Handle PDF upload (Provincial user) — uploads PDF & sets status to 'Pending Approval'
  const handleUploadPdfSubmit = async () => {
    if (!approvalFile || !supabase || !selectedSitRep) return
    if (approvalFile.type !== 'application/pdf') {
      showSuccess('Validation Error', 'Only PDF files are allowed.')
      return
    }
    setUploadingApproval(true)
    try {
      const ownerId = selectedSitRep.event_id || selectedEvent?.id
      const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(APPROVAL_BUCKET)
        .upload(path, approvalFile, { contentType: 'application/pdf', upsert: false })
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}. Ensure bucket "${APPROVAL_BUCKET}" exists.`)
      const { data: urlData } = supabase.storage.from(APPROVAL_BUCKET).getPublicUrl(uploadData.path)
      const pdfUrl = urlData?.publicUrl ?? null

      const { error: updateError } = await supabase
        .from('situational_reports')
        .update({ status: 'Pending Approval', approved_pdf_url: pdfUrl })
        .eq('id', selectedSitRep.id)
      if (updateError) throw updateError

      setSitRepVersions(prev => prev.map(v =>
        v.id === selectedSitRep.id ? { ...v, status: 'Pending Approval', approved_pdf_url: pdfUrl } : v
      ))

      // Notify Provincial Approvers
      try {
        const userProvince = user?.province
        if (userProvince) {
          const { data: approvers } = await supabase
            .from('users')
            .select('id')
            .eq('province', userProvince)
            .eq('account_type', 'Provincial Approver')
          
          if (approvers?.length > 0) {
            const notifications = approvers.map(u => ({
              user_id: u.id,
              type: 'sitrep_submission',
              title: 'New Sitrep Submission',
              message: `A new situational report "${selectedSitRep.title}" has been submitted for your approval.`,
              data: { sitrep_id: selectedSitRep.id, event_id: selectedEvent?.id }
            }))
            await supabase.from('notifications').insert(notifications)
          }
        }
      } catch (notifErr) {
        console.error('Failed to send submission notifications:', notifErr)
      }

      // Auto-mark notifications for this SitRep as read (clears rejections)
      if (selectedSitRep?.id) {
        await markSitRepNotificationsAsRead(selectedSitRep.id)
      }

      setShowApprovalUploadModal(false)
      setApprovalConfirmMessage('The signed PDF has been uploaded successfully. The report is now pending approval by the Provincial Approver.')
      setShowApprovalConfirmation(true)
    } catch (err) {
      showSuccess('Error', err.message || 'Failed to upload PDF.')
    } finally {
      setUploadingApproval(false)
    }
  }



  // Legacy: handle approval from preview modal (kept for backward compatibility)
  const handleApprovalSubmit = handleUploadPdfSubmit

  // Handle "Edit Report" from approved view — reset to Pending
  const handleEditApprovedReport = async (event) => {
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('events')
        .update({ approval_status: 'Pending', approved_pdf_url: null })
        .eq('id', event.id)
      if (error) throw error

      setLocalApprovalMap(prev => ({
        ...prev,
        [event.id]: { status: 'Pending', url: null }
      }))
      setShowApprovedView(false)
      setApprovedViewEvent(null)
      // Open the normal preview flow
      handleViewMore(event)
    } catch (err) {
      showSuccess('Error', 'Failed to reset approval: ' + err.message)
    }
  }

  // Handle opening the LGU Status Modal
  const handleOpenLguStatus = async (event, version) => {
    setLguStatusEvent(event)
    setLguStatusVersion(version)
    setShowLguStatusModal(true)
    setLguStatusLoading(true)
    setLguStatusData({ submitted: [], pending: [] })

    try {
      const tables = [
        'related_incidents', 'roads_and_bridges', 'power_reports',
        'water_supply_reports', 'communication_lines_reports',
        'damaged_houses_reports', 'class_suspension_reports',
        'work_suspension_reports', 'declaration_state_of_calamity_reports',
        'pre_emptive_evacuation_reports', 'assistance_provided_reports'
      ]

      const uniqueCities = new Set()

      // 1. Get Cities from Affected Population
      const { data: apReports } = await supabase
        .from('reports')
        .select('id')
        .eq('event_id', event.id)
        .eq('situational_report_id', version.id)

      if (apReports?.length) {
        const { data: rows } = await supabase
          .from('report_rows')
          .select('barangay')
          .in('report_id', apReports.map(r => r.id))

        rows?.forEach(r => {
          const city = getCityForBarangay(r.barangay)
          if (city) uniqueCities.add(city)
        })
      }

      // 2. Get Cities from other tables
      const otherDataResults = await Promise.all(tables.map(tbl =>
        supabase.from(tbl).select('barangay')
          .eq('event_id', event.id)
          .eq('situational_report_id', version.id)
      ))

      otherDataResults.forEach(res => {

        res.data?.forEach(r => {
          const city = getCityForBarangay(r.barangay)
          if (city) uniqueCities.add(city)
        })
      })

      const submitted = Array.from(uniqueCities).sort()
      const pending = provinceCities.filter(city => !uniqueCities.has(city)).sort()

      setLguStatusData({ submitted, pending })
    } catch (err) {
      console.error('Failed to fetch LGU status:', err)
      showSuccess('Error', 'Failed to fetch LGU submission status.')
    } finally {
      setLguStatusLoading(false)
    }
  }


  const fetchActiveEventIds = useCallback(async () => {
    if (!supabase) return
    setLoadingActive(true)
    try {
      // 1. Fetch which event_ids have situational_reports and their statuses
      const { data: sitreps } = await supabase
        .from('situational_reports')
        .select('event_id, status')
      
      const pIds = new Set()
      const aIds = new Set()
      const anySitRepIds = new Set()
      
      sitreps?.forEach(s => {
        anySitRepIds.add(s.event_id)
        const st = (s.status || 'Draft').toLowerCase()
        if (st === 'sent' || st === 'pending approval') {
          pIds.add(s.event_id)
        } else if (st === 'approved') {
          aIds.add(s.event_id)
        }
      })

      // 2. Fetch which event_ids have ANY data in detailed tables (including reports)
      const tables = [
        'reports', 'related_incidents', 'roads_and_bridges',
        'power_reports', 'water_supply_reports', 'communication_lines_reports',
        'damaged_houses_reports', 'class_suspension_reports', 'work_suspension_reports',
        'declaration_state_of_calamity_reports', 'pre_emptive_evacuation_reports',
        'assistance_provided_reports', 'assistance_lgus_agencies_reports',
        'agriculture_damage_reports', 'infrastructure_damage_reports'
      ]

      const promises = tables.map(t =>
        supabase.from(t).select('event_id').not('event_id', 'is', null)
      )

      const results = await Promise.all(promises)
      const ids = new Set(anySitRepIds)
      results.forEach(res => {
        if (res.data) {
          res.data.forEach(row => ids.add(row.event_id))
        }
      })
      
      setActiveEventIds(ids)
      setPendingEventIds(pIds)
      setApprovedEventIds(aIds)
    } catch (err) {
      console.error('Failed to fetch active events:', err)
      setActiveEventIds(new Set())
      setPendingEventIds(new Set())
      setApprovedEventIds(new Set())
    } finally {
      setLoadingActive(false)
    }
  }, [])

  useEffect(() => {
    fetchActiveEventIds()
  }, [fetchActiveEventIds])

  const filteredEvents = useMemo(() => {
    let list = [...events]

    if (statusFilter === 'pending') {
      if (pendingEventIds) list = list.filter(e => pendingEventIds.has(e.id))
    } else if (statusFilter === 'approved') {
      if (approvedEventIds) list = list.filter(e => approvedEventIds.has(e.id))
    } else if (activeEventIds) {
      list = list.filter(e => activeEventIds.has(e.id))
    } else if (eventsLoading || loadingActive) {
      return []
    }

    if (searchTerm) {
      const low = searchTerm.toLowerCase()
      list = list.filter((e) => e.name?.toLowerCase().includes(low))
    }

    // Regional users only see events that have at least one approved sitrep
    if (isRegional) {
      if (approvedEventIds) {
        list = list.filter(e => approvedEventIds.has(e.id))
      } else if (eventsLoading || loadingActive) {
        return []
      }
    }

    return list
  }, [events, searchTerm, activeEventIds, eventsLoading, loadingActive, isRegional])

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents]
    list.sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]
      if (sortKey === 'startDate') {
        va = new Date(va || 0).getTime()
        vb = new Date(vb || 0).getTime()
      } else {
        va = String(va || '').toLowerCase()
        vb = String(vb || '').toLowerCase()
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [filteredEvents, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize))
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedEvents.slice(start, start + pageSize)
  }, [sortedEvents, currentPage, pageSize])
  const filteredSitReps = useMemo(() => {
    if (!selectedEvent) return []
    let list = sitRepVersions || []
    
    if (isRegional || isProvincialApprover || (!isSuperAdmin && !isProvincial)) {
      list = list.filter(r => (r.status || 'Draft').toLowerCase() === 'approved')
    }

    if (statusFilter === 'pending') {
      list = list.filter(r => (r.status || 'Draft').toLowerCase() === 'sent' || (r.status || 'Draft').toLowerCase() === 'pending approval')
    } else if (statusFilter === 'approved') {
      list = list.filter(r => (r.status || 'Draft').toLowerCase() === 'approved')
    }

    return list.filter(r => 
      r.title?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [sitRepVersions, selectedEvent, searchTerm, statusFilter, isProvincialApprover, isSuperAdmin])

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return CATEGORY_ORDER
    const low = searchTerm.toLowerCase()
    return CATEGORY_ORDER.filter(catKey => 
      CATEGORY_LABELS[catKey]?.toLowerCase().includes(low)
    )
  }, [searchTerm])

  const filteredDetails = useMemo(() => {
    if (!searchTerm) return lguDetailRows
    const low = searchTerm.toLowerCase()
    return lguDetailRows.filter(row => {
      return Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(low)
      )
    })
  }, [lguDetailRows, searchTerm])



  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortIcon = ({ columnKey }) => {
    if (sortKey !== columnKey) return <ChevronDown size={14} className="consolidated-sort-icon inactive" />
    return sortAsc ? <ChevronUp size={14} className="consolidated-sort-icon" /> : <ChevronDown size={14} className="consolidated-sort-icon" />
  }

  const fetchEventConsolidatedData = async (event, situationalReportId = null) => {
    if (!supabase) return null

    const totalByCity = {}
    const byCityCategory = {}
    const toCity = (row, bKey) => row?.city || getCityForBarangay(row?.[bKey]) || (row?.[bKey] ? row[bKey] : 'Unknown')
    // If a situationalReportId is provided, we fetch ONLY for that version.
    // Otherwise (Regional consolidation), we gather only APPROVED reports.
    let reportsToConsolidate = []
    if (situationalReportId) {
      reportsToConsolidate = [situationalReportId]
    } else {
      const { data: approvedSitreps } = await supabase
        .from('situational_reports')
        .select('id')
        .eq('event_id', event.id)
        .eq('status', 'Approved')
      reportsToConsolidate = (approvedSitreps || []).map(r => r.id)
    }

    if (reportsToConsolidate.length === 0 && !situationalReportId) {
      return { categoryTotals: {}, byCityCategory: {} }
    }

    // 1. Affected Population (Table: reports)
    let query = supabase.from('reports').select('id')
    if (situationalReportId) {
      query = query.eq('situational_report_id', situationalReportId)
    } else if (reportsToConsolidate.length > 0) {
      query = query.in('situational_report_id', reportsToConsolidate)
    } else {
      query = query.eq('event_id', event.id)
    }
    const { data: recentReports } = await query
    let reportIds = (recentReports || []).map((r) => r.id)

    // Fallback for reports table
    if (reportIds.length === 0 && situationalReportId) {
      const { data: fallbackReports } = await supabase.from('reports').select('id').eq('event_id', event.id)
      reportIds = (fallbackReports || []).map(r => r.id)
    }
    
    const details = {
      affectedPopulation: [],
      relatedIncidents: [],
      roadsAndBridges: [],
      power: [],
      communicationLines: [],
      damagedHouses: [],
      classSuspension: [],
      workSuspension: [],
      stateOfCalamity: [],
      preEmptiveEvacuation: [],
      assistanceProvided: [],
      assistanceLgus: [],
      agricultureDamage: [],
      infrastructureDamage: [],
      waterSupply: []
    }

    if (reportIds.length > 0) {
      const { data: reportRows } = await supabase
        .from('report_rows')
        .select('*')
        .in('report_id', reportIds)
      
      reportRows?.forEach(row => {
          const city = toCity(row, 'barangay')
          const families = Number(row?.affected_families ?? 0) || 0
          const persons = Number(row?.affected_persons ?? 0) || 0
          details.affectedPopulation.push({ ...row, city, families, persons })

          totalByCity[city] = (totalByCity[city] || 0) + 1
          if (!byCityCategory[city]) byCityCategory[city] = {}

          if (!byCityCategory[city].affectedPopulation) {
            byCityCategory[city].affectedPopulation = { families: 0, persons: 0 }
          }
          byCityCategory[city].affectedPopulation.families += families
          byCityCategory[city].affectedPopulation.persons += persons
        })
    }

    // 2. Multi-table categories
    const detailTables = [
      { table: 'related_incidents', category: 'relatedIncidents', barangayKey: 'barangay' },
      { table: 'roads_and_bridges', category: 'roadsAndBridges', barangayKey: 'barangay' },
      { table: 'power_reports', category: 'power', barangayKey: 'barangay' },
      { table: 'communication_lines_reports', category: 'communicationLines', barangayKey: 'barangay' },
      { table: 'damaged_houses_reports', category: 'damagedHouses', barangayKey: 'barangay' },
      { table: 'class_suspension_reports', category: 'classSuspension', barangayKey: 'barangay' },
      { table: 'work_suspension_reports', category: 'workSuspension', barangayKey: 'barangay' },
      { table: 'declaration_state_of_calamity_reports', category: 'stateOfCalamity', barangayKey: 'barangay' },
      { table: 'pre_emptive_evacuation_reports', category: 'preEmptiveEvacuation', barangayKey: 'barangay' },
      { table: 'assistance_provided_reports', category: 'assistanceProvided', barangayKey: 'barangay' },
      { table: 'assistance_lgus_agencies_reports', category: 'assistanceLgus', barangayKey: 'barangay' },
      { table: 'agriculture_damage_reports', category: 'agricultureDamage', barangayKey: 'barangay' },
      { table: 'infrastructure_damage_reports', category: 'infrastructureDamage', barangayKey: 'barangay' },
      { table: 'water_supply_reports', category: 'waterSupply', barangayKey: 'barangay' },
    ]


    for (const { table, category, barangayKey } of detailTables) {
      let selectStr = '*'
      if (table === 'roads_and_bridges') {
        selectStr = '*, roads_and_bridges_sections(name)'
      }
      let q = supabase.from(table).select(selectStr)
      if (situationalReportId) {
        q = q.or(`situational_report_id.eq.${situationalReportId},event_id.eq.${event.id}`)
      } else if (reportsToConsolidate.length > 0) {
        q = q.in('situational_report_id', reportsToConsolidate)
      } else {
        q = q.eq('event_id', event.id)
      }
      const { data: rows } = await q
      let finalRows = rows || []
      // If we found rows specifically for this sitrep, use only those
      if (situationalReportId && finalRows.some(r => r.situational_report_id === situationalReportId)) {
        finalRows = finalRows.filter(r => r.situational_report_id === situationalReportId)
      }

      for (const row of finalRows) {
        const city = toCity(row, barangayKey)
        if (!city) continue

        let finalRow = { ...row }
        if (category === 'roadsAndBridges' && row.roads_and_bridges_sections) {
          const sections = row.roads_and_bridges_sections
          finalRow.road_bridge_name = (Array.isArray(sections) ? sections : [sections])
            .map(s => typeof s === 'object' ? s.name : s)
            .filter(Boolean)
            .join(', ') || row.road_bridge_name
        }

        details[category].push({ ...finalRow, city })
        totalByCity[city] = (totalByCity[city] || 0) + 1
        if (!byCityCategory[city]) byCityCategory[city] = {}

        if (category === 'relatedIncidents') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, ongoing: 0, resolved: 0 }
          byCityCategory[city][category].total++
          if (row.status === 'Resolved') byCityCategory[city][category].resolved++
          else byCityCategory[city][category].ongoing++
        }
        else if (category === 'roadsAndBridges') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, roads: 0, bridges: 0 }
          byCityCategory[city][category].total++
          if (row.classification === 'Bridge') byCityCategory[city][category].bridges++
          else byCityCategory[city][category].roads++
        }
        else if (['power', 'communicationLines'].includes(category)) {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, interrupted: 0, restored: 0 }
          byCityCategory[city][category].total++
          byCityCategory[city][category].interrupted++
          const restoredDate = category === 'power' ? row.date_restored : row.date_restoration;
          if (restoredDate || row.status === 'Resolved' || row.status === 'Restored' || row.status_of_communication === 'Restored') {
            byCityCategory[city][category].restored++
          }
        }
        else if (category === 'damagedHouses') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, totally: 0, partially: 0 }
          const tot = Number(row.totally_damaged || 0)
          const part = Number(row.partially_damaged || 0)
          byCityCategory[city][category].total += (tot + part)
          byCityCategory[city][category].totally += tot
          byCityCategory[city][category].partially += part
        }
        else if (category === 'assistanceProvided') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, cost: 0 }
          byCityCategory[city][category].total++
          byCityCategory[city][category].cost += Number(row.fnfi_amount || row.cost_php || row.amount || 0)
        }
        else if (category === 'assistanceLgus') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, amount: 0 }
          byCityCategory[city][category].total++
          byCityCategory[city][category].amount += Number(row.amount || 0)
        }
        else if (category === 'agricultureDamage') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, farmers: 0, value: 0 }
          byCityCategory[city][category].total++
          byCityCategory[city][category].farmers += Number(row.farmers_affected || 0)
          byCityCategory[city][category].value += Number(row.production_loss_value || row.value_loss || row.cost_of_damage || 0)
        }
        else if (category === 'infrastructureDamage') {
          if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, cost: 0 }
          byCityCategory[city][category].total++
          byCityCategory[city][category].cost += Number(row.cost || row.estimated_cost || 0)
        }
        else {
          byCityCategory[city][category] = (byCityCategory[city][category] || 0) + 1
        }
      }
    }

    // 3. Totals and Categorization Filtering
    let wq = supabase
      .from('water_supply_reports')
      .select('*')
      .eq('event_id', event.id)
    
    if (reportsToConsolidate.length > 0) {
      wq = wq.in('situational_report_id', reportsToConsolidate)
    }
    const { data: waterRows } = await wq
    const waterTotal = (waterRows || []).length
    if (waterTotal > 0) {
      details.waterSupply = (waterRows || []).map(w => ({ ...w, city: toCity(w, 'barangay') }))
      totalByCity['N/A'] = (totalByCity['N/A'] || 0) + waterTotal
      if (!byCityCategory['N/A']) byCityCategory['N/A'] = {}

      let restored = 0
      for (const w of waterRows) {
        if (w.date_restored || w.status === 'Resolved' || w.status === 'Restored') restored++
      }
      byCityCategory['N/A']['waterSupply'] = { total: waterTotal, interrupted: waterTotal, restored }
    }

    const citySet = new Set(provinceCities.map((c) => c.toLowerCase()))
    const filteredCities = Object.keys(totalByCity).filter(
      (c) => isSuperAdmin || c === 'N/A' || citySet.has(c.toLowerCase())
    )
    const filteredByCityCategory = {}
    for (const city of filteredCities) {
      filteredByCityCategory[city] = byCityCategory[city] || {}
    }

    const categoryTotals = {}
    for (const cat of CATEGORY_ORDER) {
      if (cat === 'affectedPopulation') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            families: s.families + (cityCats[cat]?.families || 0),
            persons: s.persons + (cityCats[cat]?.persons || 0)
          }),
          { families: 0, persons: 0 }
        )
      }
      else if (cat === 'relatedIncidents') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            ongoing: s.ongoing + (cityCats[cat]?.ongoing || 0),
            resolved: s.resolved + (cityCats[cat]?.resolved || 0),
          }),
          { total: 0, ongoing: 0, resolved: 0 }
        )
      }
      else if (cat === 'roadsAndBridges') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            roads: s.roads + (cityCats[cat]?.roads || 0),
            bridges: s.bridges + (cityCats[cat]?.bridges || 0),
          }),
          { total: 0, roads: 0, bridges: 0 }
        )
      }
      else if (['power', 'waterSupply', 'communicationLines'].includes(cat)) {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            interrupted: s.interrupted + (cityCats[cat]?.interrupted || 0),
            restored: s.restored + (cityCats[cat]?.restored || 0),
          }),
          { total: 0, interrupted: 0, restored: 0 }
        )
      }
      else if (cat === 'damagedHouses') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            totally: s.totally + (cityCats[cat]?.totally || 0),
            partially: s.partially + (cityCats[cat]?.partially || 0),
          }),
          { total: 0, totally: 0, partially: 0 }
        )
      }
      else if (cat === 'assistanceProvided') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            cost: s.cost + (cityCats[cat]?.cost || 0),
          }),
          { total: 0, cost: 0 }
        )
      }
      else if (cat === 'assistanceLgus') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            amount: s.amount + (cityCats[cat]?.amount || 0),
          }),
          { total: 0, amount: 0 }
        )
      }
      else if (cat === 'agricultureDamage') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            farmers: s.farmers + (cityCats[cat]?.farmers || 0),
            value: s.value + (cityCats[cat]?.value || 0),
          }),
          { total: 0, farmers: 0, value: 0 }
        )
      }
      else if (cat === 'infrastructureDamage') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            cost: s.cost + (cityCats[cat]?.cost || 0),
          }),
          { total: 0, cost: 0 }
        )
      }
      else {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => s + (cityCats[cat] || 0),
          0
        )
      }
    }

    return {
      byCityCategory: filteredByCityCategory,
      categoryTotals,
      details
    }
  }



  // Sit Rep Version Handlers



  if (!isAllowed) {
    return (
      <div className="page consolidated-report-page">
        <header className="page-header"><h1 className="page-title">Consolidated Report</h1></header>
        <div className="consolidated-report-restricted"><p>No access.</p></div>
      </div>
    )
  }

  return (
    <div className="page consolidated-report-page">
      <div className="consolidated-report-card">
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            {view !== 'events' && (
              <button
                className="consolidated-report-back-btn"
                onClick={handleBack}
                title="Go Back"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="consolidated-report-title">Consolidated Reports</h1>
          </div>

          <div className="consolidated-report-toolbar-controls">
            <div className="consolidated-report-showing-select">
              <span className="consolidated-report-showing-label">Showing</span>
              <span className="consolidated-report-dropdown-wrap">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="consolidated-report-showing-dropdown"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <SearchInput
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setCurrentPage(1)
              }}
              suggestions={events.map(e => e.name)}
              className="consolidated-report-search-box"
            />
            {view === 'events' && (
              <div className="status-filter-group">
                <button 
                  className={`status-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved
                </button>
              </div>
            )}
            {view === 'lgus' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleExportCategoryCsv(selectedCategory)}
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
            {/* NEW: Scope-aware Download Button */}
            {(view === 'sitreps' || view === 'provinces' || view === 'lgus' || view === 'categories') && (
              <div className="consolidated-download-group" style={{ marginLeft: '1rem' }}>
                <Button
                  className="btn-primary consolidated-download-main"
                  isLoading={drillDownLoading}
                  onClick={handleConsolidatedDownloadClick}
                  title={`Download for ${selectedLgu || selectedProvince || 'Whole Region'}`}
                >
                  <Download size={18} />
                  Download Report
                </Button>
              </div>
            )}
          </div>

        </div>

        {/* Breadcrumbs */}
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
                className={`breadcrumb-item ${view === 'sitreps' ? 'active' : ''}`}
                onClick={() => navigateTo('sitreps', { event: selectedEvent })}
              >
                {selectedEvent.name}
              </button>
            </>
          )}
          {selectedSitRep && (
            <>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${view === 'provinces' || view === 'categories' ? 'active' : ''}`}
                onClick={() => navigateTo(isRegional ? 'provinces' : 'categories', { sitrep: selectedSitRep })}
              >
                {selectedSitRep.title}
              </button>
            </>
          )}
          {selectedProvince && (
            <>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${view === 'lgus' ? 'active' : ''}`}
                onClick={() => navigateTo('lgus', { province: selectedProvince })}
              >
                {selectedProvince}
              </button>
            </>
          )}
          {selectedLgu && (
            <>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${view === 'categories' ? 'active' : ''}`}
                onClick={() => navigateTo('categories', { lgu: selectedLgu })}
              >
                {selectedLgu}
              </button>
            </>
          )}
          {selectedCategory && (
            <>
              <span className="breadcrumb-separator">/</span>
              <button
                className={`breadcrumb-item ${view === 'details' ? 'active' : ''}`}
                onClick={() => {
                  if (view === 'details') return
                  navigateTo(selectedLgu ? 'details' : 'lgus', { category: selectedCategory })
                }}
              >
                {CATEGORY_LABELS[selectedCategory]}
              </button>
            </>
          )}
        </div>

        <div className="consolidated-report-table-wrapper">
          {view === 'events' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>
                    <button type="button" className="consolidated-th-sort" onClick={() => handleSort('name')}>
                      Event Name
                      <SortIcon columnKey="name" />
                    </button>
                  </th>
                  <th style={{ width: '25%' }}>
                    <button type="button" className="consolidated-th-sort" onClick={() => handleSort('startDate')}>
                      Date of Event
                      <SortIcon columnKey="startDate" />
                    </button>
                  </th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Alert Lvl</th>
                  <th className="col-action" style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventsLoading || loadingActive ? (
                  <tr>
                    <td colSpan="5" className="consolidated-report-loading">
                      <LoadingSpinner small label="Loading incidents..." />
                    </td>
                  </tr>
                ) : sortedEvents.length === 0 ? (
                  <tr><td colSpan="5" className="consolidated-report-empty">No incidents with reports found.</td></tr>
                ) : (
                  paginatedEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="event-name-cell">
                        {hasUnread(event.id) && <span className="table-ping" title="New Activity"></span>}
                        {event.name}
                      </td>
                      <td className="event-date-cell">
                        {event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`alert-pill alert-${(event.alertStatus || 'white').toLowerCase()}`}>
                          {(event.alertStatus || 'white').toUpperCase()}
                        </span>
                      </td>
                      <td className="col-action" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="consolidated-report-btn-sitrep"
                          onClick={async () => {
                            setVersionsLoading(true)
                            const sitreps = await fetchSituationalReports(event.id)
                            setSitRepVersions(sitreps || [])
                            setVersionsLoading(false)
                            navigateTo('sitreps', { event })
                          }}
                          title="View Situation Reports"
                        >
                          <FileText size={14} />
                          Sit Rep
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {view === 'sitreps' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>No.</th>
                  <th style={{ width: '35%' }}>Title</th>
                  <th style={{ width: '25%' }}>Created At</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                  <th className="col-action" style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versionsLoading ? (
                  <tr>
                    <td colSpan="5" className="consolidated-report-loading">
                      <LoadingSpinner small label="Loading versions..." />
                    </td>
                  </tr>
                ) : filteredSitReps.length === 0 ? (
                  <tr><td colSpan="5" className="consolidated-report-empty">No situation reports found.</td></tr>
                ) : (
                  filteredSitReps.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.report_number}</td>
                      <td className="event-name-cell">
                        {hasUnread(selectedEvent?.id, v.id) && <span className="table-ping" title="New Notification"></span>}
                        {v.title}
                      </td>
                      <td className="event-date-cell">
                        {new Date(v.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill status-${(v.status || 'Draft').toLowerCase().replace(/\s+/g, '-')}`}>
                          {(v.status || 'Draft').toUpperCase()}
                        </span>
                      </td>
                      <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>

                        {/* View uploaded PDF (available to all roles) */}
                        {v.approved_pdf_url && (
                          <Button
                            className="consolidated-report-btn-sitrep pdf-btn"
                            onClick={() => {
                              setPreviewUrl(v.approved_pdf_url)
                              setShowPreviewModal(true)
                            }}
                          >
                            <FileText size={14} />
                            PDF
                          </Button>
                        )}
                          <Button
                            className="consolidated-report-btn-sitrep download-btn"
                            isLoading={processingId === v.id}
                            onClick={() => handleSitRepDownloadClick(v)}
                          >
                            <FileDown size={14} />
                            Download
                          </Button>
                          <Button
                            className="consolidated-report-btn-sitrep details-btn"
                            isLoading={drillDownLoading}
                            onClick={async () => {
                              setDrillDownLoading(true)
                              const data = await fetchEventConsolidatedData(selectedEvent, v.id)
                              setCategoryData(data)
                              setDrillDownLoading(false)
                              if (isRegional) {
                                setView('provinces')
                                setSelectedSitRep(v)
                              } else {
                                navigateTo('categories', { sitrep: v })
                              }
                            }}
                          >
                            Details
                          </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {view === 'provinces' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '80%' }}>Province Name</th>
                  <th className="col-action" style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {PROVINCE_NAMES.map(prov => (
                  <tr key={prov}>
                    <td className="event-name-cell" style={{ fontWeight: 600 }}>{prov}</td>
                    <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', border: 'none' }}>
                      <Button
                        className="consolidated-report-btn-sitrep pdf-btn"
                        onClick={() => handleConsolidatedDownloadClick(prov, null, 'pdf')}
                      >
                        <FileText size={14} />
                        PDF
                      </Button>
                      <Button
                        className="consolidated-report-btn-sitrep download-btn"
                        onClick={() => handleConsolidatedDownloadClick(prov, null, 'both')}
                      >
                        <FileDown size={14} />
                        Download
                      </Button>
                      <Button
                        className="consolidated-report-btn-sitrep details-btn"
                        onClick={() => {
                          setSelectedProvince(prov)
                          setView('lgus')
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'categories' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Category</th>
                  <th style={{ width: '30%', textAlign: 'center' }}>{selectedLgu ? 'Submissions' : 'Total Submissions'}</th>
                  <th className="col-action" style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drillDownLoading ? (
                  <tr>
                    <td colSpan="3" className="consolidated-report-loading">
                      <LoadingSpinner small label="Loading categories..." />
                    </td>
                  </tr>
                ) : filteredCategories.map((catKey) => {
                  const label = CATEGORY_LABELS[catKey]
                  const totals = selectedLgu 
                    ? categoryData?.byCityCategory?.[selectedLgu]?.[catKey]
                    : categoryData?.categoryTotals?.[catKey]
                  
                  const count = typeof totals === 'object' ? (totals.total || totals.families || 0) : (totals || 0)
                  
                  if (count === 0) return null

                  return (
                    <tr key={catKey}>
                      <td className="event-name-cell">{label}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{count}</td>
                      <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', border: 'none' }}>
                        <Button
                          className="consolidated-report-btn-sitrep pdf-btn"
                          onClick={() => handleConsolidatedDownloadClick(null, null, 'pdf')}
                        >
                          <FileText size={14} />
                          PDF
                        </Button>
                        <Button
                          className="consolidated-report-btn-sitrep download-btn"
                          onClick={() => handleConsolidatedDownloadClick(null, null, 'both')}
                        >
                          <FileDown size={14} />
                          Download
                        </Button>
                        <Button
                          className="consolidated-report-btn-sitrep details-btn"
                          onClick={async () => {
                            setSelectedCategory(catKey)
                            if (selectedLgu) {
                              setDrillDownLoading(true)
                              try {
                                const rows = await fetchLguCategoryDetails(selectedEvent.id, selectedSitRep.id, catKey, selectedLgu)
                                setLguDetailRows(rows)
                                setView('details')
                              } finally {
                                setDrillDownLoading(false)
                              }
                            } else {
                              setView('lgus')
                            }
                          }}
                        >
                          {selectedLgu ? 'Details' : 'LGUs'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {view === 'lgus' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '80%' }}>LGU Name</th>
                  <th className="col-action" style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let citiesList = []
                  if (selectedProvince) {
                    citiesList = getCitiesForProvince(selectedProvince)
                  } else {
                    citiesList = Object.keys(categoryData?.byCityCategory || {})
                  }

                  let citiesWithData = citiesList.filter(city => {
                    const cityCats = categoryData?.byCityCategory?.[city]
                    if (!cityCats) return false
                    if (selectedCategory) {
                      const catData = cityCats[selectedCategory]
                      if (!catData) return false
                      const count = typeof catData === 'object' ? (catData.total || catData.families || 0) : (catData || 0)
                      return count > 0
                    }
                    return Object.values(cityCats).some(catData => {
                      const count = typeof catData === 'object' ? (catData.total || catData.families || 0) : (catData || 0)
                      return count > 0
                    })
                  }).sort()

                  if (searchTerm) {
                    const low = searchTerm.toLowerCase()
                    citiesWithData = citiesWithData.filter(city => city.toLowerCase().includes(low))
                  }

                  if (citiesWithData.length === 0) {
                    return <tr><td colSpan="2" className="consolidated-report-empty">No LGU submissions found for this selection.</td></tr>
                  }

                  return citiesWithData.map(city => (
                    <tr key={city}>
                      <td className="event-name-cell" style={{ fontWeight: 600 }}>{city}</td>
                      <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', border: 'none' }}>
                        <Button
                          className="consolidated-report-btn-sitrep pdf-btn"
                          onClick={() => handleConsolidatedDownloadClick(null, city, 'pdf')}
                        >
                          <FileText size={14} />
                          PDF
                        </Button>
                        <Button
                          className="consolidated-report-btn-sitrep download-btn"
                          onClick={() => handleConsolidatedDownloadClick(null, city, 'both')}
                        >
                          <FileDown size={14} />
                          Download
                        </Button>
                        <Button
                          className="consolidated-report-btn-sitrep details-btn"
                          onClick={async () => {
                            setSelectedLgu(city)
                            if (selectedCategory) {
                              setDrillDownLoading(true)
                              try {
                                const rows = await fetchLguCategoryDetails(selectedEvent.id, selectedSitRep.id, selectedCategory, city)
                                setLguDetailRows(rows)
                                navigateTo('details', { lgu: city })
                              } finally {
                                setDrillDownLoading(false)
                              }
                            } else {
                              setView('categories')
                            }
                          }}
                        >
                          {selectedCategory ? 'Details' : 'Categories'}
                        </Button>
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          )}

          {view === 'details' && (
            <div className="consolidated-details-container">
              <div className="details-view-header">
                <h3 className="details-view-title">Edit {CATEGORY_LABELS[selectedCategory]} Report Data</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button type="button" className="details-view-add-row-btn" onClick={handleAddRow}>
                    <Plus size={16} />
                    Add Row
                  </button>
                </div>
              </div>
              <div className="report-table-wrapper">
                <table className="report-table">
                  {/* Dynamically render headers based on category */}
                  <thead>
                    {renderDetailsHeader(selectedCategory)}
                  </thead>
                  <tbody>
                    {drillDownLoading ? (
                      <tr>
                        <td colSpan="15" className="consolidated-report-loading">
                          <LoadingSpinner small label="Loading details..." />
                        </td>
                      </tr>
                    ) : filteredDetails.length === 0 ? (
                      <tr><td colSpan="15" className="consolidated-report-empty">No detailed entries found.</td></tr>
                    ) : (
                      filteredDetails.map((row, idx) => (
                        <tr key={row.id || idx}>
                          {renderDetailsRow(selectedCategory, row, idx)}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="details-view-footer">
                <button type="button" className="details-view-btn-cancel" onClick={handleBack}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="details-view-btn-submit" 
                  onClick={handleSubmitDetails}
                  disabled={submittingDetails}
                >
                  {submittingDetails ? 'Saving...' : 'Submit Report'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="consolidated-report-pagination">
          <button
            type="button"
            className="consolidated-report-pagination-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &lt; Previous
          </button>
          <div className="consolidated-report-pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
              .map((p, i, arr) => (
                <span key={p}>
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="consolidated-report-pagination-ellipsis">...</span>}
                  <button
                    type="button"
                    className={`consolidated-report-pagination-num ${currentPage === p ? 'active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {String(p).padStart(2, '0')}
                  </button>
                </span>
              ))}
          </div>
          <button
            type="button"
            className="consolidated-report-pagination-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </button>
        </div>
      </div>

      {/* ── PDF Preview + Edit Modal ── */}
      {showPdfEditModal && generatedSummaryData && createPortal(
        <div className="preview-modal-overlay" onClick={() => setShowPdfEditModal(false)}>
          <div
            className="preview-modal-content glass-modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '95vw', maxWidth: '1400px', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}
          >
            {/* Header */}
            <div className="preview-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FileDown size={20} style={{ color: '#2563eb' }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Download PDF Report</h2>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>{generatedSummaryData.pdfParams.reportTitle}</p>
                </div>
              </div>
              <button className="preview-modal-close" onClick={() => setShowPdfEditModal(false)} title="Close">
                <X size={20} />
              </button>
            </div>

            {/* Body: two columns */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '0', minHeight: 0 }}>

              {/* LEFT: PDF Preview */}
              <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '0.875rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155' }}>PDF Preview</span>
                  <button
                    type="button"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onClick={() => {
                      if (pdfPreviewBlobUrl) URL.revokeObjectURL(pdfPreviewBlobUrl)
                      const newUrl = generatePdfBlobUrl(generatedSummaryData.pdfParams, aiGeneratedSummaryText, { preparedBy, notedBy, approvedBy })
                      setPdfPreviewBlobUrl(newUrl)
                    }}
                  >
                    <RefreshCw size={13} />
                    Refresh Preview
                  </button>
                </div>
                <div style={{ flex: 1, background: '#e2e8f0', overflow: 'hidden' }}>
                  {pdfPreviewBlobUrl ? (
                    <iframe
                      src={pdfPreviewBlobUrl}
                      title="PDF Preview"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LoadingSpinner label="Generating preview..." />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Summary Editor + Signatories */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>

                {/* Summary editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem', flexShrink: 0 }}>
                    <Sparkles size={15} style={{ color: '#7c3aed', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>AI-Generated Summary</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '0.1rem 0.5rem', background: '#f1f5f9', borderRadius: '9999px' }}>editable</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.75rem', flexShrink: 0 }}>Edit the summary below. Click "Refresh Preview" to see your changes reflected in the PDF.</p>
                  <textarea
                    value={aiGeneratedSummaryText}
                    onChange={e => setAiGeneratedSummaryText(e.target.value)}
                    style={{
                      flex: 1, minHeight: 0, padding: '0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem',
                      fontSize: '0.8125rem', lineHeight: 1.7, color: '#0f172a', background: '#f8fafc', resize: 'none',
                      fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s', overflow: 'auto'
                    }}
                    onFocus={e => e.target.style.borderColor = '#2563eb'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Signatories mini section */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Users size={15} style={{ color: '#2563eb' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>Signatories</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>(auto-populated)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Prepared by</span>
                      <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>
                        {preparedBy.length > 0 ? preparedBy.map(p => p.name).join(', ') : <em style={{ color: '#94a3b8', fontWeight: 400 }}>None</em>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Noted by</span>
                      <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>
                        {notedBy ? notedBy.name : <em style={{ color: '#94a3b8', fontWeight: 400 }}>None</em>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Approved by</span>
                      <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>
                        {approvedBy ? approvedBy.name : <em style={{ color: '#94a3b8', fontWeight: 400 }}>None</em>}
                      </span>
                    </div>
                    <div style={{ gridColumn: 'span 3', borderTop: '1px dashed #e2e8f0', marginTop: '0.25rem', paddingTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => { setShowPdfEditModal(false); setShowSignatoriesModal(true) }}
                        style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
                      >
                        Change Signatories
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="modal-btn-cancel"
                    style={{ flex: 1 }}
                    onClick={() => setShowPdfEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: '0.75rem 1rem', borderRadius: '0.75rem', background: '#2563eb', color: '#fff',
                      border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'opacity 0.15s'
                    }}
                    onClick={handleConfirmDownload}
                  >
                    <FileDown size={16} />
                    Download PDF
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Signatories Modal ── */}
      {showSignatoriesModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowSignatoriesModal(false)}>
          <div className="modal-content glass-modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="versions-title-stack">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ color: '#2563eb' }}><Sparkles size={18} /></div>
                  <h2 className="versions-event-name">Report Signatories</h2>
                </div>
                <p className="modal-subtitle">Assign who prepared, noted, and approved this report. Only active users from {province || 'this region'} are shown.</p>
              </div>
              <button className="modal-close" onClick={() => setShowSignatoriesModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem 0' }}>
              {/* Search */}
              <div style={{ padding: '0 1.5rem 0.875rem' }}>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={signatorySearch}
                  onChange={(e) => setSignatorySearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.625rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.8125rem', color: '#1e293b', background: '#f8fafc', outline: 'none', transition: 'all 0.2s' }}
                />
              </div>

              {/* Role Tabs */}
              <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                {[
                  { key: 'preparedBy', label: 'Prepared by', count: preparedBy.length },
                  { key: 'notedBy', label: 'Noted by', count: notedBy ? 1 : 0 },
                  { key: 'approvedBy', label: 'Approved by', count: approvedBy ? 1 : 0 },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSignatoryRole(tab.key)}
                    style={{
                      flex: 1, padding: '0.75rem 0.25rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                      border: 'none', borderBottom: signatoryRole === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                      background: 'transparent', color: signatoryRole === tab.key ? '#2563eb' : '#64748b',
                      transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
                    }}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{ background: '#2563eb', color: '#fff', borderRadius: '9999px', padding: '0.05rem 0.45rem', fontSize: '0.7rem', fontWeight: 700 }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Signatory List */}
              <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {availableSignatories
                  .filter(s => s.name.toLowerCase().includes(signatorySearch.toLowerCase()))
                  .map(s => {
                    let isSelected = false
                    if (signatoryRole === 'preparedBy') isSelected = preparedBy.some(p => p.id === s.id)
                    else if (signatoryRole === 'notedBy') isSelected = notedBy?.id === s.id
                    else if (signatoryRole === 'approvedBy') isSelected = approvedBy?.id === s.id

                    const handleSelect = () => {
                      if (signatoryRole === 'preparedBy') {
                        setPreparedBy(prev => isSelected ? prev.filter(p => p.id !== s.id) : [...prev, s])
                      } else if (signatoryRole === 'notedBy') {
                        setNotedBy(isSelected ? null : s)
                      } else if (signatoryRole === 'approvedBy') {
                        setApprovedBy(isSelected ? null : s)
                      }
                    }

                    return (
                      <div key={s.id} onClick={handleSelect} style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '0.75rem 1rem', borderRadius: '0.875rem', cursor: 'pointer',
                        background: isSelected ? 'rgba(37,99,235,0.06)' : '#f8fafc',
                        border: isSelected ? '1px solid rgba(37,99,235,0.2)' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                          background: isSelected ? 'rgba(37,99,235,0.12)' : 'rgba(0,0,0,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.875rem', color: isSelected ? '#2563eb' : '#64748b'
                        }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0f172a' }}>{s.name}</div>
                        </div>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                          background: isSelected ? '#2563eb' : 'transparent',
                          border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', transition: 'all 0.15s ease'
                        }}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    )
                  })}
                {availableSignatories.length === 0 && (
                  <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    No active users found in {province || 'this region'}.
                  </div>
                )}
              </div>

              {/* Summary strip */}
              {(preparedBy.length > 0 || notedBy || approvedBy) && (
                <div style={{ padding: '0.875rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: '0.8125rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  {preparedBy.length > 0 && <span><strong>Prepared:</strong> {preparedBy.map(p => p.name).join(', ')}</span>}
                  {notedBy && <span><strong>Noted:</strong> {notedBy.name}</span>}
                  {approvedBy && <span><strong>Approved:</strong> {approvedBy.name}</span>}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setShowSignatoriesModal(false)}>
                Cancel
              </button>
              <button className="modal-btn-primary" onClick={handleConfirmDownload}>
                <FileDown size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload PDF Modal — Provincial User */}
      {showApprovalUploadModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowApprovalUploadModal(false)}>
          <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="versions-title-stack">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span className="sitrep-badge" style={{ background: '#2563eb' }}>UPLOAD</span>
                  <h2 className="versions-event-name">Upload Signed PDF</h2>
                </div>
                <p className="modal-subtitle">Upload the signed situational report PDF. It will be sent to the Provincial Approver for review.</p>
              </div>
              <button className="modal-close" onClick={() => setShowApprovalUploadModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
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
                    showSuccess('Validation Error', 'Only PDF files are allowed.');
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
                        <FileDown size={24} className="approval-file-icon modern-file-icon" />
                      </div>
                      <div className="modern-file-details">
                        <span className="approval-file-name" title={approvalFile.name}>{approvalFile.name}</span>
                        <span className="approval-file-size">{(approvalFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="approval-file-remove modern-remove-btn"
                      onClick={() => {
                        setApprovalFile(null)
                        const input = document.getElementById('approval-pdf-input')
                        if (input) input.value = ''
                      }}
                      title="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setShowApprovalUploadModal(false)}>Cancel</button>
              <Button
                className="modal-btn-primary"
                onClick={handleUploadPdfSubmit}
                isLoading={uploadingApproval}
                disabled={!approvalFile}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Upload size={15} />
                  <span>Submit for Approval</span>
                </div>
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Action Confirmation Modal */}
      {showApprovalConfirmation && createPortal(
        <div className="modal-overlay" onClick={() => setShowApprovalConfirmation(false)}>
          <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-confirm">
              <div className="modal-confirm-icon modal-confirm-icon--success">
                <CheckCircle size={32} />
              </div>
              <h2 className="modal-confirm-title">Success</h2>
              <p className="modal-confirm-text">{approvalConfirmMessage}</p>
              <div className="modal-confirm-footer">
                <button className="modal-btn-primary" onClick={() => setShowApprovalConfirmation(false)} style={{ minWidth: '120px' }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Approved View Modal */}
      {showApprovedView && approvedViewEvent && createPortal(
        <div className="modal-overlay" onClick={() => { setShowApprovedView(false); setApprovedViewEvent(null) }}>
          <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="approved-view-title-stack">
                <h2>{approvedViewEvent.name}</h2>
              </div>
              <button className="modal-close" onClick={() => { setShowApprovedView(false); setApprovedViewEvent(null) }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="approved-view-details">
                <div className="approved-view-detail-row">
                  <span className="approved-view-label">Event</span>
                  <span className="approved-view-value">{approvedViewEvent.name}</span>
                </div>
                <div className="approved-view-detail-row">
                  <span className="approved-view-label">Date</span>
                  <span className="approved-view-value">
                    {approvedViewEvent.startDate
                      ? new Date(approvedViewEvent.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : '-'}
                  </span>
                </div>
                <div className="approved-view-detail-row">
                  <span className="approved-view-label">Alert Level</span>
                  <span className="approved-view-value">
                    <span className={`alert-pill alert-${(approvedViewEvent.alertStatus || 'white').toLowerCase()}`}>
                      {(approvedViewEvent.alertStatus || 'white').toUpperCase()}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {(() => {
                const pdfUrl = getApprovedPdfUrl(approvedViewEvent) || approvedViewEvent.approvedPdfUrl
                return pdfUrl ? (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-btn-success"
                    style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
                  >
                    <Download size={16} />
                    Download PDF
                  </a>
                ) : (
                  <span className="approved-view-no-pdf">No PDF available</span>
                )
              })()}
              <button
                className="modal-btn-cancel"
                onClick={() => handleEditApprovedReport(approvedViewEvent)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Edit3 size={16} />
                Edit Report
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
      }

      {/* ── Sit Rep Versions Modal ── */}
      {
        showVersionsModal && versionsEvent && createPortal(
          <div className="modal-overlay" onClick={() => setShowVersionsModal(false)}>
            <div className="modal-content glass-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="versions-title-stack">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span className="sitrep-badge">VERSIONS</span>
                    <h2 className="versions-event-name">{versionsEvent.name}</h2>
                  </div>
                  <p className="modal-subtitle">Select a situation report to generate its consolidated summary.</p>
                </div>
                <button className="modal-close" onClick={() => setShowVersionsModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ background: '#f8fafc', position: 'relative' }}>
                {processingId && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                    borderRadius: 'inherit'
                  }}>
                    <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Generating Report...</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Fetching data and building PDF preview</span>
                  </div>
                )}
                {versionsLoading ? (
                  <div className="versions-loading">
                    <RefreshCw size={24} className="animate-spin" />
                    <span>Loading versions...</span>
                  </div>
                ) : sitRepVersions.length === 0 ? (
                  <div className="versions-empty">
                    <div className="versions-empty-icon"><FileText size={40} /></div>
                    <h3>No Sit Reps Found</h3>
                    <p>Add situation reports in the "Add Report" section first to generate consolidated versions here.</p>
                  </div>
                ) : (
                  <div className="versions-list">
                    {sitRepVersions.map((v) => (
                      <div key={v.id} className="version-card">
                        <div className="version-card-main">
                          <div className="version-card-icon"><FileText size={18} /></div>
                          <div className="version-card-info">
                            <span className="version-card-title">{v.title}</span>
                            <span className="version-card-date">
                              Created: {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="version-card-actions">
                          <button
                            type="button"
                            className="version-action-btn btn-lgu"
                            onClick={(e) => { e.stopPropagation(); handleOpenLguStatus(versionsEvent, v); }}
                            title="View LGU Submission Status"
                          >
                            <FileBarChart size={14} />
                            <span>LGUs</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="modal-btn-cancel" onClick={() => setShowVersionsModal(false)}>Close</button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* ── LGU Submission Status Modal ── */}
      {showLguStatusModal && lguStatusEvent && createPortal(
        <div className="modal-overlay" onClick={() => setShowLguStatusModal(false)}>
          <div className="modal-content glass-modal" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="versions-title-stack">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span className="sitrep-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.2)' }}>LGU STATUS</span>
                  <h2 className="versions-event-name">{lguStatusEvent.name}</h2>
                </div>
                <p className="modal-subtitle">{lguStatusVersion?.title} &mdash; Tracking submission progress</p>
              </div>
              <button className="modal-close" onClick={() => setShowLguStatusModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body lgu-status-body">
              {lguStatusLoading ? (
                <div className="versions-loading">
                  <div className="loading-spinner-small"></div>
                  <span>Loading LGU submissions...</span>
                </div>
              ) : (
                <div className="lgu-status-container">
                  <div className="lgu-status-column submitted-col">
                    <div className="lgu-status-col-header">
                      <h3>Submitted</h3>
                      <span className="lgu-count-badge success">{lguStatusData.submitted.length}</span>
                    </div>
                    <ul className="lgu-list">
                      {lguStatusData.submitted.length > 0 ? (
                        lguStatusData.submitted.map(lgu => (
                          <li key={lgu} className="lgu-item submitted">
                            <CheckCircle size={16} className="lgu-icon" />
                            {lgu}
                          </li>
                        ))
                      ) : (
                        <li className="lgu-item empty">No LGUs have submitted yet.</li>
                      )}
                    </ul>
                  </div>

                  <div className="lgu-status-column pending-col">
                    <div className="lgu-status-col-header">
                      <h3>Not Submitted</h3>
                      <span className="lgu-count-badge warning">{lguStatusData.pending.length}</span>
                    </div>
                    <ul className="lgu-list">
                      {lguStatusData.pending.length > 0 ? (
                        lguStatusData.pending.map(lgu => (
                          <li key={lgu} className="lgu-item pending">
                            <RefreshCw size={16} className="lgu-icon" />
                            {lgu}
                          </li>
                        ))
                      ) : (
                        <li className="lgu-item empty success-empty">All LGUs have submitted!</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setShowLguStatusModal(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showTextEditorModal && (
        <div className="modal-overlay" onClick={() => setShowTextEditorModal(false)}>
          <div className="modal-content glass-modal remarks-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{textEditorModalData?.title || 'Edit Text'}</h2>
              <button type="button" className="modal-close" onClick={() => setShowTextEditorModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <textarea
                className="remarks-textarea"
                value={textEditorModalData?.tempValue || ''}
                onChange={(e) => setTextEditorModalData({ ...textEditorModalData, tempValue: e.target.value })}
                placeholder={`Enter ${textEditorModalData?.title?.toLowerCase().replace('edit ', '') || 'text'} here...`}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-btn-cancel" onClick={() => setShowTextEditorModal(false)}>Cancel</button>
              <button type="button" className="modal-btn-primary" onClick={saveTextUpdate}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadTypeModal && (
        <div className="modal-overlay" onClick={() => setShowDownloadTypeModal(false)}>
          <div className="modal-content glass-modal download-type-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Download Format</h2>
              <button type="button" className="modal-close" onClick={() => setShowDownloadTypeModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>
                How would you like to download this consolidated report?
              </p>
              <div className="download-options-grid">
                <div className="download-option-card" onClick={() => {
                  setShowDownloadTypeModal(false)
                  setShowSignatoriesModal(true)
                }}>
                  <div className="download-option-icon"><FileText size={28} /></div>
                  <div>
                    <div className="download-option-title">PDF Document</div>
                    <div className="download-option-desc">Includes official signatures & formatting</div>
                  </div>
                </div>

                <div className="download-option-card csv" onClick={() => {
                  setShowDownloadTypeModal(false)
                  generateConsolidatedCsv({
                    ...generatedSummaryData.pdfParams,
                    summaryText: aiGeneratedSummaryText,
                    signatories: { preparedBy: [], notedBy: null, approvedBy: null }
                  })
                }}>
                  <div className="download-option-icon"><FileBarChart size={28} /></div>
                  <div>
                    <div className="download-option-title">CSV Datasets</div>
                    <div className="download-option-desc">Clean data in ZIP format (Excel compatible)</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-btn-cancel" onClick={() => setShowDownloadTypeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {showPreviewModal && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-content premium-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="premium-preview-header">
              <h2 className="premium-preview-title">Report PDF Preview</h2>
              <button type="button" className="premium-preview-close-icon" onClick={() => setShowPreviewModal(false)} title="Close">
                <X size={20} />
              </button>
            </div>
            <div className="premium-preview-body">
              <iframe
                src={previewUrl}
                title="PDF Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
            <div className="premium-preview-footer">
              <button type="button" className="premium-preview-btn-close" onClick={() => setShowPreviewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
