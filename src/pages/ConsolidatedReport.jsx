import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext, Link, useNavigate, useLocation } from 'react-router-dom'
import { CaretDown, CaretUp, ArrowLeft, Download, FileText, FileArrowDown, ChartBar, PencilSimple, Trash, Eye, Plus, X, CheckCircle, Check, Upload, Calendar, Clock, PaperPlaneRight, ArrowSquareOut, Sparkle, ArrowsClockwise, Users } from '@phosphor-icons/react'
import SearchInput from '../components/SearchInput'
import SearchableSelect from '../components/SearchableSelect'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import api from '../lib/api'
import { generateRelatedIncidentsPdf } from '../lib/generateRelatedIncidentsPdf'
import { LGU_NAMES, getBarangaysForCity, getCityForBarangay } from '../data/locations'
import { getCitiesForProvince, PROVINCES_WITH_CITIES, PROVINCE_NAMES } from '../data/provinces'
import { useEvents } from '../contexts/EventContext'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import HeaderFooterModal from '../components/HeaderFooterModal'
import ConfirmationModal from '../components/ConfirmationModal'
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
  const { events, loading: eventsLoading, showSuccess, showToast, showConfirm, fetchSituationalReports, sendSituationalReport, notifications, markSitRepNotificationsAsRead, markEventNotificationsAsRead } = useEvents()

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

  const isProvincial = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin'
  const isProvincialApprover = user?.account_type === 'Provincial Approver'
  const isRegional = user?.account_type === 'Regional' || user?.account_type === 'Regional Admin'
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
    showConfirm({
      title: 'Delete Row',
      message: 'Are you sure you want to delete this row? This will be applied when you save changes.',
      onConfirm: () => {
        const rowToDelete = lguDetailRows[index]
        if (rowToDelete?.id) {
          setDeletedRowIds((prev) => [...prev, rowToDelete.id])
        }
        setLguDetailRows((prev) => prev.filter((_, i) => i !== index))
      }
    })
  }

  const handleSubmitDetails = async () => {
    if (!selectedCategory || !selectedEvent || !selectedSitRep) return
    const tableName = CATEGORY_TO_TABLE[selectedCategory]
    if (!tableName) return

    showConfirm({
      title: 'Submit Changes',
      message: 'Are you sure you want to save all changes to this report section?',
      onConfirm: async () => {
        setSubmittingDetails(true)
        try {
          // 1. Handle Deletions
          if (deletedRowIds.length > 0) {
            const table = tableName === 'reports' ? 'report_rows' : tableName
            await api.delete(`/reports/${table}/bulk`, { data: { ids: deletedRowIds } })
          }

          // 2. Handle Upserts
          if (selectedCategory === 'affectedPopulation') {
            const { data: reports } = await api.get('/reports/reports', {
              params: { event_id: selectedEvent.id, situational_report_id: selectedSitRep.id }
            })

            let reportId
            if (reports?.length) {
              reportId = reports[0].id
            } else {
              const { data: newReport } = await api.post('/reports/reports', {
                event_id: selectedEvent.id,
                situational_report_id: selectedSitRep.id
              })
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

            if (toInsert.length > 0) await api.post('/reports/report_rows/bulk', toInsert)
            if (toUpdate.length > 0) await api.patch('/reports/report_rows/bulk', toUpdate)

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

            if (toInsert.length > 0) await api.post(`/reports/${tableName}/bulk`, toInsert)
            if (toUpdate.length > 0) await api.patch(`/reports/${tableName}/bulk`, toUpdate)
          }

          showSuccess('Success', 'Report details updated successfully.')
          setDeletedRowIds([])
          handleBack()
        } catch (err) {
          console.error('Submit details error:', err)
          alert('Error saving changes: ' + (err.response?.data?.error || err.message))
        } finally {
          setSubmittingDetails(false)
        }
      }
    })
  }

  const navigateTo = (newView, data = {}) => {
    setView(newView)
    if (data.event !== undefined) {
      setSelectedEvent(data.event)
      if (data.event?.id) markEventNotificationsAsRead(data.event.id)
    }
    if (data.sitrep !== undefined) {
      setSelectedSitRep(data.sitrep)
      if (data.sitrep?.id) markSitRepNotificationsAsRead(data.sitrep.id)
    }
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
    try {
      const params = { status: 'Active' }
      if (!isSuperAdmin && !isRegional && province) {
        params.province = province
      } else if (isRegional && province) {
        params.province = province
      }

      const { data } = await api.get('/users', { params })
      if (data) {
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
    } catch (err) {
      console.error('Error fetching signatories:', err)
    }
  }

  // fetchSituationalReports and markSitRepNotificationsAsRead are now handled by EventContext


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

    // If there's an approved PDF, just download it (though the modal might be skipped)
    if (selectedSitRep?.approved_pdf_url && selectedSitRep?.status === 'Approved') {
      const a = document.createElement('a')
      a.href = selectedSitRep.approved_pdf_url
      a.target = '_blank'
      a.download = `${(generatedSummaryData.pdfParams.reportTitle || 'Report').replace(/\s+/g, '-')}.pdf`
      a.click()
      setShowSignatoriesModal(false)
      return
    }

    const finalDoc = generateRelatedIncidentsPdf({
      ...generatedSummaryData.pdfParams,
      summaryText: aiGeneratedSummaryText,
      signatories: { preparedBy, notedBy, approvedBy }
    })
    const fileName = `${(generatedSummaryData.pdfParams.reportTitle || 'Report').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    finalDoc.save(fileName)
    setShowSignatoriesModal(false)
    if (setShowPdfEditModal) setShowPdfEditModal(false)
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td><input type="number" value={row.cost || row.estimated_cost || 0} onChange={(e) => handleRowChange(idx, row.estimated_cost !== undefined ? 'estimated_cost' : 'cost', parseInt(e.target.value) || 0)} /></td>
            <td>
              <div
                className="remarks-trigger"
                onClick={() => openTextEditorModal(idx, 'remarks', row.remarks, 'Edit Remarks')}
              >
                {row.remarks || <span className="placeholder">Add remarks...</span>}
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
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
                <PencilSimple size={14} />
              </div>
            </td>
            <td className="col-actions">
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => handleDeleteRow(idx)}
                title="Delete Row"
                icon={<Trash size={14} />}
              />
            </td>
          </>
        )
    }
  }

  const handleExportCategoryCsv = async (category) => {
    if (!selectedSitRep || !selectedEvent) return
    setDrillDownLoading(true)
    try {
      const { data: allRows } = await api.get(`/reports/${CATEGORY_TO_TABLE[category]}`, {
        params: {
          event_id: selectedEvent.id,
          situational_report_id: selectedSitRep.id
        }
      })

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
    if (!event) return 'Pending'
    if (localApprovalMap[event.id]) return localApprovalMap[event.id].status || 'Pending'
    return event.approvalStatus || 'Pending'
  }

  const getApprovedPdfUrl = (event) => {
    if (!event) return null
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
    if (!approvalFile || !selectedSitRep) return
    if (approvalFile.type !== 'application/pdf') {
      showToast('Validation Error', 'Only PDF files are allowed.', 'warning')
      return
    }
    setUploadingApproval(true)
    try {
      const formData = new FormData()
      formData.append('file', approvalFile)

      const { data: uploadData } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const pdfUrl = uploadData.url

      await api.patch(`/situational-reports/${selectedSitRep.id}`, {
        status: 'Pending Approval',
        pending_pdf_url: pdfUrl
      })

      setSitRepVersions(prev => prev.map(v =>
        v.id === selectedSitRep.id ? { ...v, status: 'Pending Approval', pending_pdf_url: pdfUrl } : v
      ))

      // Notify Approvers (Provincial Approvers in same province + Super Admins/Regional)
      try {
        const userProvince = user?.province
        const { data: approvers } = await api.get('/users', {
          params: {
            account_type: ['Provincial Approver', 'Super Admin', 'Regional Admin', 'Regional'],
            status: 'Active'
          }
        })

        // Filter: Provincial Approvers must match province, others get everything
        const targetUsers = (approvers || []).filter(u => {
          if (u.id === user?.id) return false
          if (u.account_type === 'Provincial Approver') {
            return u.province === userProvince
          }
          return true // Super Admin / Regional see everything
        })

        if (targetUsers.length > 0) {
          const notifications = targetUsers.map(u => ({
            user_id: u.id,
            type: 'sitrep_submission',
            title: 'New Sitrep Submission',
            message: `A new situational report "${selectedSitRep.title}" has been submitted for your approval.`,
            data: { sitrep_id: selectedSitRep.id, event_id: selectedEvent?.id }
          }))
          await api.post('/notifications/bulk', notifications)
        }
      } catch (notifErr) {
        console.error('Failed to send submission notifications:', notifErr)
      }

      if (selectedSitRep?.id) {
        await markSitRepNotificationsAsRead(selectedSitRep.id)
      }

      setShowApprovalUploadModal(false)
      setApprovalConfirmMessage('The signed PDF has been uploaded successfully. The report is now pending approval by the Provincial Approver.')
      setShowApprovalConfirmation(true)
    } catch (err) {
      showToast('Error', (err.response?.data?.error || err.message || 'Failed to upload PDF.'), 'danger')
    } finally {
      setUploadingApproval(false)
    }
  }



  // Legacy: handle approval from preview modal (kept for backward compatibility)
  const handleApprovalSubmit = handleUploadPdfSubmit

  // Handle "Edit Report" from approved view — reset to Pending
  const handleEditApprovedReport = async (event) => {
    try {
      await api.patch(`/events/${event.id}`, { approval_status: 'Pending', approved_pdf_url: null })
      setLocalApprovalMap(prev => ({
        ...prev,
        [event.id]: { status: 'Pending', url: null }
      }))
      setShowApprovedView(false)
      setApprovedViewEvent(null)
      handleViewMore(event)
    } catch (err) {
      showToast('Error', 'Failed to reset approval: ' + (err.response?.data?.error || err.message), 'danger')
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
      const { data: results } = await api.get('/reports/consolidated', {
        params: {
          event_id: event.id,
          situational_report_ids: version.id
        }
      })

      const uniqueCities = new Set()
      Object.values(results).forEach(rows => {
        rows.forEach(r => {
          const city = r.city || getCityForBarangay(r.barangay)
          if (city) uniqueCities.add(city)
        })
      })

      const submitted = Array.from(uniqueCities).sort()
      const pending = provinceCities.filter(city => !uniqueCities.has(city)).sort()

      setLguStatusData({ submitted, pending })
    } catch (err) {
      console.error('Failed to fetch LGU status:', err)
      showToast('Error', 'Failed to fetch LGU submission status.', 'danger')
    } finally {
      setLguStatusLoading(false)
    }
  }


  useEffect(() => {
    // No longer fetching active event IDs for filters
  }, [])

  const filteredEvents = useMemo(() => {
    let list = [...events]

    if (searchTerm) {
      const low = searchTerm.toLowerCase()
      list = list.filter((e) => e.name?.toLowerCase().includes(low))
    }

    return list
  }, [events, searchTerm])

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

    list = list.filter(r => (r.status || 'Draft').toLowerCase() === 'approved')

    return list.filter(r =>
      r.title?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [sitRepVersions, selectedEvent, searchTerm])

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
    if (sortKey !== columnKey) return <CaretDown size={14} className="consolidated-sort-icon inactive" />
    return sortAsc ? <CaretUp size={14} className="consolidated-sort-icon" /> : <CaretDown size={14} className="consolidated-sort-icon" />
  }

  const fetchEventConsolidatedData = async (event, situationalReportId = null) => {
    const totalByCity = {}
    const byCityCategory = {}
    const details = {
      affectedPopulation: [], relatedIncidents: [], roadsAndBridges: [],
      power: [], communicationLines: [], damagedHouses: [],
      classSuspension: [], workSuspension: [], stateOfCalamity: [],
      preEmptiveEvacuation: [], assistanceProvided: [], assistanceLgus: [],
      agricultureDamage: [], infrastructureDamage: [], waterSupply: []
    }

    try {
      let sitRepIds = []
      if (situationalReportId) {
        sitRepIds = [situationalReportId]
      } else {
        const params = { event_id: event.id, status: 'Approved' }
        if (!isRegional && user?.province) params.province = user.province
        const { data: approvedSitreps } = await api.get('/situational-reports', { params })
      }

      if (sitRepIds.length === 0 && !situationalReportId) {
        return { categoryTotals: {}, byCityCategory: {} }
      }

      const { data: results } = await api.get('/reports/consolidated', {
        params: {
          event_id: event.id,
          situational_report_ids: sitRepIds.join(',')
        }
      })

      const toCity = (row, bKey) => row?.city || getCityForBarangay(row?.[bKey]) || (row?.[bKey] ? row[bKey] : 'Unknown')

      // Process results and populate details/totals (keeping the original aggregation logic)
      Object.entries(results).forEach(([table, rows]) => {
        let category = table
        if (table === 'affected_population') category = 'affectedPopulation'
        if (table === 'power_reports') category = 'power'
        if (table === 'communication_lines_reports') category = 'communicationLines'
        if (table === 'damaged_houses_reports') category = 'damagedHouses'
        if (table === 'class_suspension_reports') category = 'classSuspension'
        if (table === 'work_suspension_reports') category = 'workSuspension'
        if (table === 'declaration_state_of_calamity_reports') category = 'stateOfCalamity'
        if (table === 'pre_emptive_evacuation_reports') category = 'preEmptiveEvacuation'
        if (table === 'assistance_provided_reports') category = 'assistanceProvided'
        if (table === 'assistance_lgus_agencies_reports') category = 'assistanceLgus'
        if (table === 'agriculture_damage_reports') category = 'agricultureDamage'
        if (table === 'infrastructure_damage_reports') category = 'infrastructureDamage'
        if (table === 'water_supply_reports') category = 'waterSupply'
        if (table === 'related_incidents') category = 'relatedIncidents'
        if (table === 'roads_and_bridges') category = 'roadsAndBridges'

        rows.forEach(row => {
          const city = toCity(row, 'barangay')
          if (!city) return

          // Guard: initialize array if category key is unmapped/unknown
          if (!Array.isArray(details[category])) details[category] = []
          details[category].push({ ...row, city })
          totalByCity[city] = (totalByCity[city] || 0) + 1
          if (!byCityCategory[city]) byCityCategory[city] = {}

          // Original detailed aggregation logic...
          if (category === 'affectedPopulation') {
            if (!byCityCategory[city].affectedPopulation) {
              byCityCategory[city].affectedPopulation = {
                families: 0, persons: 0, brgy_count: 0, ecs_cum: 0, ecs_now: 0,
                in_fam_cum: 0, in_fam_now: 0, in_per_cum: 0, in_per_now: 0,
                out_fam_cum: 0, out_fam_now: 0, out_per_cum: 0, out_per_now: 0
              }
            }
            byCityCategory[city].affectedPopulation.families += Number(row.affected_families || 0)
            byCityCategory[city].affectedPopulation.persons += Number(row.affected_persons || 0)
            byCityCategory[city].affectedPopulation.brgy_count += 1
            byCityCategory[city].affectedPopulation.ecs_cum += Number(row.ecs_cum || 0)
            byCityCategory[city].affectedPopulation.ecs_now += Number(row.ecs_now || 0)
            byCityCategory[city].affectedPopulation.in_fam_cum += Number(row.inside_families_cum || 0)
            byCityCategory[city].affectedPopulation.in_fam_now += Number(row.inside_families_now || 0)
            byCityCategory[city].affectedPopulation.in_per_cum += Number(row.inside_persons_cum || 0)
            byCityCategory[city].affectedPopulation.in_per_now += Number(row.inside_persons_now || 0)
            byCityCategory[city].affectedPopulation.out_fam_cum += Number(row.outside_families_cum || 0)
            byCityCategory[city].affectedPopulation.out_fam_now += Number(row.outside_families_now || 0)
            byCityCategory[city].affectedPopulation.out_per_cum += Number(row.outside_persons_cum || 0)
            byCityCategory[city].affectedPopulation.out_per_now += Number(row.outside_persons_now || 0)
          } else if (category === 'relatedIncidents') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = {
              total: 0, ongoing: 0, resolved: 0, flooded: 0, subsided: 0, receding: 0,
              fallenDebris: 0, stormSurge: 0, other: 0
            }
            byCityCategory[city][category].total++
            const type = (row.type_of_incident || '').toLowerCase()
            const status = (row.status || '').toLowerCase()
            if (type.includes('flood')) {
              if (status.includes('subsided')) byCityCategory[city][category].subsided++
              else if (status.includes('receding')) byCityCategory[city][category].receding++
              else byCityCategory[city][category].flooded++
            } else if (type.includes('debris') || type.includes('tree')) {
              byCityCategory[city][category].fallenDebris++
            } else if (type.includes('surge')) {
              byCityCategory[city][category].stormSurge++
            } else {
              byCityCategory[city][category].other++
            }
            if (row.status === 'Resolved') byCityCategory[city][category].resolved++
            else byCityCategory[city][category].ongoing++
          } else if (category === 'roadsAndBridges') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, roads: 0, bridges: 0, passable: 0, notPassable: 0 }
            byCityCategory[city][category].total++
            if (row.classification === 'Bridge') byCityCategory[city][category].bridges++
            else byCityCategory[city][category].roads++
            if (row.status === 'Passable' || row.status === 'Open' || row.status?.toLowerCase().includes('passable')) {
              byCityCategory[city][category].passable++
            } else {
              byCityCategory[city][category].notPassable++
            }
          } else if (['power', 'communicationLines'].includes(category)) {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, interrupted: 0, restored: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].interrupted++
            const restoredDate = category === 'power' ? row.date_restored : row.date_restoration
            if (restoredDate || row.status === 'Resolved' || row.status === 'Restored') {
              byCityCategory[city][category].restored++
            }
          } else if (category === 'damagedHouses') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, totally: 0, partially: 0, amount: 0 }
            const tot = Number(row.totally_damaged || 0)
            const part = Number(row.partially_damaged || 0)
            byCityCategory[city][category].total += (tot + part)
            byCityCategory[city][category].totally += tot
            byCityCategory[city][category].partially += part
            byCityCategory[city][category].amount += Number(row.amount_php || row.amount || 0)
          } else if (category === 'assistanceProvided') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, cost: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].cost += Number(row.fnfi_amount || row.cost_php || row.amount || 0)
          } else if (category === 'assistanceLgus') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, amount: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].amount += Number(row.amount || 0)
          } else if (category === 'agricultureDamage') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, farmers: 0, value: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].farmers += Number(row.farmers_affected || 0)
            byCityCategory[city][category].value += Number(row.production_loss_value || row.value_loss || 0)
          } else if (category === 'infrastructureDamage') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, cost: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].cost += Number(row.cost || row.estimated_cost || 0)
          } else if (category === 'preEmptiveEvacuation') {
            if (!byCityCategory[city][category]) byCityCategory[city][category] = { total: 0, families: 0, persons: 0 }
            byCityCategory[city][category].total++
            byCityCategory[city][category].families += Number(row.families || 0)
            byCityCategory[city][category].persons += Number(row.persons || 0)
          } else {
            byCityCategory[city][category] = (byCityCategory[city][category] || 0) + 1
          }
        })
      })
    } catch (err) {
      console.error('fetchEventConsolidatedData error:', err)
    }

    // 3. Filtering and Totals
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
            persons: s.persons + (cityCats[cat]?.persons || 0),
            brgy_count: s.brgy_count + (cityCats[cat]?.brgy_count || 0),
            ecs_cum: s.ecs_cum + (cityCats[cat]?.ecs_cum || 0),
            ecs_now: s.ecs_now + (cityCats[cat]?.ecs_now || 0),
            in_fam_cum: s.in_fam_cum + (cityCats[cat]?.in_fam_cum || 0),
            in_fam_now: s.in_fam_now + (cityCats[cat]?.in_fam_now || 0),
            in_per_cum: s.in_per_cum + (cityCats[cat]?.in_per_cum || 0),
            in_per_now: s.in_per_now + (cityCats[cat]?.in_per_now || 0),
            out_fam_cum: s.out_fam_cum + (cityCats[cat]?.out_fam_cum || 0),
            out_fam_now: s.out_fam_now + (cityCats[cat]?.out_fam_now || 0),
            out_per_cum: s.out_per_cum + (cityCats[cat]?.out_per_cum || 0),
            out_per_now: s.out_per_now + (cityCats[cat]?.out_per_now || 0)
          }),
          {
            families: 0, persons: 0, brgy_count: 0, ecs_cum: 0, ecs_now: 0,
            in_fam_cum: 0, in_fam_now: 0, in_per_cum: 0, in_per_now: 0,
            out_fam_cum: 0, out_fam_now: 0, out_per_cum: 0, out_per_now: 0
          }
        )
      }
      else if (cat === 'relatedIncidents') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            ongoing: s.ongoing + (cityCats[cat]?.ongoing || 0),
            resolved: s.resolved + (cityCats[cat]?.resolved || 0),
            flooded: s.flooded + (cityCats[cat]?.flooded || 0),
            subsided: s.subsided + (cityCats[cat]?.subsided || 0),
            receding: s.receding + (cityCats[cat]?.receding || 0),
            fallenDebris: s.fallenDebris + (cityCats[cat]?.fallenDebris || 0),
            stormSurge: s.stormSurge + (cityCats[cat]?.stormSurge || 0),
            other: s.other + (cityCats[cat]?.other || 0),
          }),
          { total: 0, ongoing: 0, resolved: 0, flooded: 0, subsided: 0, receding: 0, fallenDebris: 0, stormSurge: 0, other: 0 }
        )
      }
      else if (cat === 'roadsAndBridges') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            total: s.total + (cityCats[cat]?.total || 0),
            roads: s.roads + (cityCats[cat]?.roads || 0),
            bridges: s.bridges + (cityCats[cat]?.bridges || 0),
            passable: s.passable + (cityCats[cat]?.passable || 0),
            notPassable: s.notPassable + (cityCats[cat]?.notPassable || 0),
          }),
          { total: 0, roads: 0, bridges: 0, passable: 0, notPassable: 0 }
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
            amount: s.amount + (cityCats[cat]?.amount || 0),
          }),
          { total: 0, totally: 0, partially: 0, amount: 0 }
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
      else if (cat === 'preEmptiveEvacuation') {
        categoryTotals[cat] = Object.values(filteredByCityCategory).reduce(
          (s, cityCats) => ({
            families: s.families + (cityCats[cat]?.families || 0),
            persons: s.persons + (cityCats[cat]?.persons || 0),
          }),
          { families: 0, persons: 0 }
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

  const handleDownloadCsv = async (sitrep, event = selectedEvent) => {
    const sitRepId = sitrep?.id || null
    // If we're doing a specific sitrep, use its ID for processing state, else use a string
    setProcessingId(sitRepId || `csv-${event.id}`)
    try {
      const { data: allData } = await api.get('/reports/all-types', {
        params: { situational_report_id: sitRepId }
      })

      const exportData = {
        eventName: event?.name || 'Event',
        province: province || 'Region 1',
        summaryText: sitrep?.title || sitrep?.summary || '',
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
      showSuccess('Export Success', 'Consolidated report generated successfully.')
    } catch (err) {
      console.error('CSV Generation Error:', err)
      showToast('Error', 'Failed to generate CSV.', 'danger')
    } finally {
      setProcessingId(null)
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
              <Button
                variant="ghost"
                onClick={handleBack}
                title="Go Back"
                icon={<ArrowLeft size={20} />}
              />
            )}
            <h1 className="consolidated-report-title">
              {view === 'events' ? 'Consolidated Reports' : 'Consolidated Reports'}
            </h1>
          </div>

          <div className="consolidated-report-toolbar-controls">

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
            {/* Status filters removed */}
            {view === 'lgus' && (
              <Button
                variant="subtle"
                onClick={() => handleExportCategoryCsv(selectedCategory)}
                icon={<Download size={16} />}
              >
                Export CSV
              </Button>
            )}
            {/* Consolidated download button removed from toolbar */}
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
        </div>

        <div className="consolidated-report-table-wrapper">
          {view === 'events' && (
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>
                    <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('name')}>
                      Event Name
                      {sortKey === 'name'
                        ? (sortAsc ? <CaretUp size={13} className="consolidated-sort-icon" /> : <CaretDown size={13} className="consolidated-sort-icon" />)
                        : <CaretDown size={13} className="consolidated-sort-icon inactive" />}
                    </Button>
                  </th>
                  <th style={{ width: '20%' }}>
                    <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('startDate')}>
                      Date of Event
                      {sortKey === 'startDate'
                        ? (sortAsc ? <CaretUp size={13} className="consolidated-sort-icon" /> : <CaretDown size={13} className="consolidated-sort-icon" />)
                        : <CaretDown size={13} className="consolidated-sort-icon inactive" />}
                    </Button>
                  </th>
                  {(isRegional || isSuperAdmin) && (
                    <th style={{ width: '20%' }}>Province</th>
                  )}
                  <th style={{ textAlign: 'center', width: '10%' }}>Alert Lvl</th>
                  <th className="col-action" style={{ width: '20%', textAlign: 'center' }}>Actions</th>
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
                        {hasUnread(event.id) && (
                          <span
                            className="table-ping"
                            title="Clear Notifications"
                            onClick={(e) => {
                              e.stopPropagation();
                              markEventNotificationsAsRead(event.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          ></span>
                        )}
                        {event.name}
                      </td>
                      <td className="event-date-cell">
                        {event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      {(isRegional || isSuperAdmin) && (
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {event.affectedProvinces?.length > 0
                            ? event.affectedProvinces.join(', ')
                            : 'Region 1'}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`alert-pill alert-${(event.alertStatus || 'white').toLowerCase()}`}>
                          {(event.alertStatus || 'white').toUpperCase()}
                        </span>
                      </td>
                      <td className="col-action" style={{ width: '250px' }}>
                        <div className="consolidated-actions">
                          <Button
                            variant="solid"
                            color="primary"
                            size="sm"
                            onClick={async () => {
                              setVersionsLoading(true)
                              const sitreps = await fetchSituationalReports(event.id)
                              setSitRepVersions(sitreps || [])
                              setVersionsLoading(false)
                              navigateTo('sitreps', { event })
                            }}
                            title="View Situation Reports"
                            leftIcon={<FileText size={14} />}
                          >
                            Sit Rep
                          </Button>
                        </div>
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
                  <th style={{ width: '35%' }}>Title</th>
                  {(isSuperAdmin || isRegional) && (
                    <th style={{ width: '15%' }}>Province</th>
                  )}
                  <th style={{ width: '25%' }}>Created At</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                  <th className="col-action" style={{ width: '250px', textAlign: 'center' }}>Actions</th>
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
                  <tr><td colSpan="4" className="consolidated-report-empty">No situation reports found.</td></tr>
                ) : (
                  filteredSitReps.map((v) => (
                    <tr key={v.id}>
                      <td className="event-name-cell">
                        {hasUnread(selectedEvent?.id, v.id) && (
                          <span
                            className="table-ping"
                            title="Clear Notifications"
                            onClick={(e) => {
                              e.stopPropagation();
                              markSitRepNotificationsAsRead(v.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          ></span>
                        )}
                        {v.title}
                      </td>
                      {(isRegional || isSuperAdmin) && (
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{v.province || '-'}</td>
                      )}
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
                      <td className="col-action" style={{ width: '250px' }}>
                        <div className="consolidated-actions">
                          {(v.approved_pdf_url || v.pending_pdf_url) ? (
                            <Button
                              variant="solid"
                              color="info"
                              size="sm"
                              onClick={() => {
                                let url = v.approved_pdf_url || v.pending_pdf_url;
                                // Local development fix: Sanitize protocol if on localhost
                                if (url && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                                  url = url.replace(/^https:\/\//, 'http://');
                                }
                                setPreviewUrl(url)
                                setShowPreviewModal(true)
                              }}
                              leftIcon={<Eye size={14} />}
                            >
                              View Details
                            </Button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              PDF Not Available
                            </span>
                          )}
                          <Button
                            variant="solid"
                            color="success"
                            size="sm"
                            onClick={() => handleDownloadCsv(v, selectedEvent)}
                            isLoading={processingId === v.id}
                            title="Download CSV (ZIP)"
                            leftIcon={<Download size={14} />}
                          >
                            CSV
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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
      </div>





      <HeaderFooterModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Report PDF Preview"
        maxWidth="1000px"
        footer={<Button variant="subtle" onClick={() => setShowPreviewModal(false)}>Close</Button>}
      >
        <div style={{ height: '70vh' }}>
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </HeaderFooterModal>
    </div>
  )
}
