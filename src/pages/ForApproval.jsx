import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { 
  CheckCircle, 
  X,
  Eye, 
  FileText, 
  Info,
  Building,
  MapPin
} from '@phosphor-icons/react'
import api from '../lib/api'
import { useEvents } from '../contexts/EventContext'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import HeaderFooterModal from '../components/HeaderFooterModal'
import '../styles/pages/PageStyles.css'
import '../styles/pages/ConsolidatedReport.css'

export default function ForApproval() {
  const { user } = useOutletContext() ?? {}
  const { 
    showSuccess, 
    showConfirm, 
    fetchPendingApprovalsCount,
    markSitRepNotificationsAsRead
  } = useEvents()

  const isLguApprover = user?.account_type === 'LGU Approver'
  const isSuperAdmin = user?.role === 'Super Admin' || user?.account_type === 'Super Admin'

  // ─── Provincial Approver State ────────────────────────────────────────────
  const [sitreps, setSitreps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewSitRep, setReviewSitRep] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [processingReview, setProcessingReview] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  // ─── LGU Approver State ───────────────────────────────────────────────────
  const [lguPending, setLguPending] = useState([])
  const [lguLoading, setLguLoading] = useState(true)
  const [showLguReviewModal, setShowLguReviewModal] = useState(false)
  const [reviewLguSubmission, setReviewLguSubmission] = useState(null)
  const [lguRejectRemarks, setLguRejectRemarks] = useState('')
  const [showLguRejectInput, setShowLguRejectInput] = useState(false)
  const [processingLguReview, setProcessingLguReview] = useState(false)

  // ─── Fetch: Provincial Approver ───────────────────────────────────────────
  const fetchPendingSitreps = useCallback(async () => {
    if (!user || isLguApprover) return
    setLoading(true)
    try {
      const params = { status: 'Pending Approval' }
      if (user.account_type === 'Provincial Approver') {
        params.province = user.province
      }
      const { data } = await api.get('/situational-reports', { params })
      setSitreps(data || [])
    } catch (err) {
      console.error('Error fetching pending sitreps:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isLguApprover])

  // ─── Fetch: LGU Approver ──────────────────────────────────────────────────
  const fetchLguPending = useCallback(async () => {
    if (!user || !isLguApprover) return
    setLguLoading(true)
    try {
      const { data } = await api.get('/lgu-submissions/pending')
      setLguPending(data || [])
    } catch (err) {
      console.error('Error fetching LGU pending submissions:', err)
    } finally {
      setLguLoading(false)
    }
  }, [user, isLguApprover])

  useEffect(() => {
    fetchPendingSitreps()
    fetchLguPending()
  }, [fetchPendingSitreps, fetchLguPending])

  // ─── Provincial Approver: Approve ─────────────────────────────────────────
  const handleApprove = async () => {
    if (!reviewSitRep) return
    showConfirm({
      title: 'Approve Report',
      message: `Are you sure you want to approve "${reviewSitRep.title}"?`,
      onConfirm: async () => {
        setProcessingReview(true)
        try {
          await api.patch(`/situational-reports/${reviewSitRep.id}`, { 
            status: 'Approved', 
            rejection_remarks: null,
            approved_pdf_url: reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url,
            pending_pdf_url: null
          })
          setSitreps(prev => prev.filter(s => s.id !== reviewSitRep.id))
          setShowReviewModal(false)
          try {
            const reportProvince = reviewSitRep.province || user?.province
            if (reportProvince) {
              const { data: provincialUsers } = await api.get('/users', {
                params: { province: reportProvince, account_type: 'Provincial' }
              })
              if (provincialUsers?.length > 0) {
                const notifications = provincialUsers.map(u => ({
                  user_id: u.id,
                  type: 'sitrep_approval',
                  title: 'Situational Report Approved',
                  message: `Your report "${reviewSitRep.title}" has been approved.`,
                  data: { sitrep_id: reviewSitRep.id, event_id: reviewSitRep.event_id }
                }))
                await api.post('/notifications/bulk', notifications)
              }
            }
          } catch (notifErr) {
            console.error('Failed to send approval notifications:', notifErr)
          }
          showSuccess('Approved', `"${reviewSitRep.title}" has been approved successfully.`)
          await markSitRepNotificationsAsRead(reviewSitRep.id)
          fetchPendingApprovalsCount()
          setTimeout(() => fetchPendingSitreps(), 1000)
        } catch (err) {
          showSuccess('Error', err.response?.data?.error || err.message || 'Failed to approve report.')
        } finally {
          setProcessingReview(false)
        }
      }
    })
  }

  // ─── Provincial Approver: Reject ──────────────────────────────────────────
  const handleReject = async () => {
    if (!reviewSitRep || !rejectRemarks.trim()) {
      showSuccess('Required', 'Please enter remarks before rejecting.')
      return
    }
    showConfirm({
      title: 'Reject Report',
      message: `Are you sure you want to reject "${reviewSitRep.title}"?`,
      type: 'danger',
      onConfirm: async () => {
        setProcessingReview(true)
        try {
          await api.patch(`/situational-reports/${reviewSitRep.id}`, { 
            status: 'Draft', 
            rejection_remarks: rejectRemarks.trim(),
            pending_pdf_url: null 
          })
          try {
            const reportProvince = reviewSitRep.province || user?.province
            if (reportProvince) {
              const { data: provincialUsers } = await api.get('/users', {
                params: { province: reportProvince, account_type: 'Provincial' }
              })
              if (provincialUsers?.length > 0) {
                const notifications = provincialUsers.map(u => ({
                  user_id: u.id,
                  type: 'sitrep_rejection',
                  title: 'Situational Report Rejected',
                  message: `Your report "${reviewSitRep.title}" was rejected. Remarks: ${rejectRemarks.trim()}`,
                  data: { sitrep_id: reviewSitRep.id, event_id: reviewSitRep.event_id, remarks: rejectRemarks.trim() }
                }))
                await api.post('/notifications/bulk', notifications)
              }
            }
          } catch (notifErr) {
            console.error('Failed to send rejection notifications:', notifErr)
          }
          showSuccess('Rejected', `"${reviewSitRep.title}" has been rejected.`)
          setShowReviewModal(false)
          await markSitRepNotificationsAsRead(reviewSitRep.id)
          fetchPendingSitreps()
          fetchPendingApprovalsCount()
        } catch (err) {
          showSuccess('Error', err.response?.data?.error || err.message || 'Failed to reject report.')
        } finally {
          setProcessingReview(false)
        }
      }
    })
  }

  // ─── LGU Approver: Approve ────────────────────────────────────────────────
  const handleLguApprove = async () => {
    if (!reviewLguSubmission) return
    showConfirm({
      title: 'Approve LGU Submission',
      message: `Approve data submitted by ${reviewLguSubmission.city} for "${reviewLguSubmission.report_title}"?`,
      onConfirm: async () => {
        setProcessingLguReview(true)
        try {
          await api.post('/lgu-submissions/approve', {
            situational_report_id: reviewLguSubmission.situational_report_id,
            city: reviewLguSubmission.city
          })
          setLguPending(prev => prev.filter(s => s.id !== reviewLguSubmission.id))
          setShowLguReviewModal(false)
          showSuccess('Approved', `${reviewLguSubmission.city}'s submission has been approved. It will now appear in consolidated reports.`)
          fetchPendingApprovalsCount()
        } catch (err) {
          showSuccess('Error', err.response?.data?.error || err.message || 'Failed to approve submission.')
        } finally {
          setProcessingLguReview(false)
        }
      }
    })
  }

  // ─── LGU Approver: Reject ─────────────────────────────────────────────────
  const handleLguReject = async () => {
    if (!reviewLguSubmission || !lguRejectRemarks.trim()) {
      showSuccess('Required', 'Please enter remarks before rejecting.')
      return
    }
    showConfirm({
      title: 'Reject LGU Submission',
      message: `Reject data from ${reviewLguSubmission.city}? They will need to revise their data.`,
      type: 'danger',
      onConfirm: async () => {
        setProcessingLguReview(true)
        try {
          await api.post('/lgu-submissions/reject', {
            situational_report_id: reviewLguSubmission.situational_report_id,
            city: reviewLguSubmission.city,
            rejection_remarks: lguRejectRemarks.trim()
          })
          setLguPending(prev => prev.filter(s => s.id !== reviewLguSubmission.id))
          setShowLguReviewModal(false)
          showSuccess('Rejected', `${reviewLguSubmission.city}'s submission has been rejected with remarks.`)
          fetchPendingApprovalsCount()
          fetchLguPending()
        } catch (err) {
          showSuccess('Error', err.response?.data?.error || err.message || 'Failed to reject submission.')
        } finally {
          setProcessingLguReview(false)
        }
      }
    })
  }

  const openLguReview = (submission) => {
    setReviewLguSubmission(submission)
    setLguRejectRemarks('')
    setShowLguRejectInput(false)
    setShowLguReviewModal(true)
  }

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  // ─── Render: LGU Approver View ────────────────────────────────────────────
  if (isLguApprover) {
    return (
      <div className="page for-approval-page">
        <div className="consolidated-report-card">
          <div className="consolidated-report-toolbar">
            <div className="consolidated-report-header-stack">
              <h1 className="consolidated-report-title">LGU Data for Approval</h1>
              <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                Review and approve LGU data submissions for {user?.city || 'your city'}.
              </p>
            </div>
          </div>

          <div className="consolidated-report-table-wrapper" style={{ marginTop: '1.5rem' }}>
            <table className="consolidated-report-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>City</th>
                  <th style={{ width: '30%' }}>Report</th>
                  <th style={{ width: '20%' }}>Event</th>
                  <th style={{ width: '15%' }}>Submitted</th>
                  <th className="col-action" style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lguLoading ? (
                  <tr><td colSpan="5" className="consolidated-report-loading">
                    <LoadingSpinner small label="Fetching pending submissions..." />
                  </td></tr>
                ) : lguPending.length === 0 ? (
                  <tr><td colSpan="5" className="consolidated-report-empty">
                    No LGU data submissions pending approval.
                  </td></tr>
                ) : (
                  lguPending.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building size={15} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 600 }}>{sub.city}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{sub.report_title || '—'}</td>
                      <td>{sub.event_name || '—'}</td>
                      <td className="event-date-cell">{formatDate(sub.updated_at)}</td>
                      <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <Button
                          variant="solid"
                          color="primary"
                          size="sm"
                          onClick={() => openLguReview(sub)}
                          icon={<Eye size={14} />}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LGU Review Modal */}
        {showLguReviewModal && reviewLguSubmission && (
          <HeaderFooterModal
            isOpen={showLguReviewModal}
            onClose={() => !processingLguReview && setShowLguReviewModal(false)}
            title={`Review: ${reviewLguSubmission.city}`}
            subtitle={`Submitted for "${reviewLguSubmission.report_title}" — ${reviewLguSubmission.event_name}`}
            maxWidth="600px"
            footer={
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', width: '100%' }}>
                <Button
                  variant="subtle"
                  onClick={() => setShowLguReviewModal(false)}
                  disabled={processingLguReview}
                >
                  Cancel
                </Button>

                {!showLguRejectInput ? (
                  <Button
                    variant="outline"
                    color="danger"
                    onClick={() => setShowLguRejectInput(true)}
                    disabled={processingLguReview}
                    icon={<X size={18} />}
                  >
                    Reject
                  </Button>
                ) : (
                  <Button
                    variant="solid"
                    color="danger"
                    onClick={handleLguReject}
                    isLoading={processingLguReview}
                    disabled={!lguRejectRemarks.trim()}
                  >
                    Confirm Rejection
                  </Button>
                )}

                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleLguApprove}
                  isLoading={processingLguReview}
                  disabled={showLguRejectInput}
                  icon={<CheckCircle size={18} />}
                >
                  Approve
                </Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Submission details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City / Municipality</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>{reviewLguSubmission.city}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Province</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>{reviewLguSubmission.province || '—'}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>{reviewLguSubmission.report_title}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submitted</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>{formatDate(reviewLguSubmission.updated_at)}</div>
                </div>
              </div>

              {/* Info notice */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1d4ed8' }}>
                <Info size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                  Approving this submission will make {reviewLguSubmission.city}'s report data visible to Provincial and Regional users in consolidated reports and the dashboard.
                </p>
              </div>

              {/* Rejection remarks */}
              {showLguRejectInput && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                    Rejection Remarks *
                  </label>
                  <textarea
                    className="modern-textarea"
                    style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #ef4444', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    placeholder="Explain why this submission is being rejected..."
                    value={lguRejectRemarks}
                    onChange={(e) => setLguRejectRemarks(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </HeaderFooterModal>
        )}
      </div>
    )
  }

  // ─── Render: Provincial / Regional Approver View ──────────────────────────
  return (
    <div className="page for-approval-page">
      <div className="consolidated-report-card">
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            <h1 className="consolidated-report-title">Reports for Approval</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
              Review and approve situational reports submitted by Provincial teams.
            </p>
          </div>
        </div>

        <div className="consolidated-report-table-wrapper" style={{ marginTop: '1.5rem' }}>
          <table className="consolidated-report-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Event</th>
                <th style={{ width: '30%' }}>Report Title</th>
                <th style={{ width: '15%' }}>Province</th>
                <th style={{ width: '15%' }}>Submitted At</th>
                <th className="col-action" style={{ width: '15%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="consolidated-report-loading">
                  <LoadingSpinner small label="Fetching pending reports..." />
                </td></tr>
              ) : sitreps.length === 0 ? (
                <tr><td colSpan="5" className="consolidated-report-empty">
                  No reports pending approval.
                </td></tr>
              ) : (
                sitreps.map((sr) => (
                  <tr key={sr.id}>
                    <td className="event-name-cell">{sr.events?.name || 'Unknown Event'}</td>
                    <td style={{ fontWeight: 500 }}>{sr.title}</td>
                    <td>{sr.province}</td>
                    <td className="event-date-cell">{formatDate(sr.created_at)}</td>
                    <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <Button
                        variant="solid"
                        color="primary"
                        size="sm"
                        onClick={() => {
                          setReviewSitRep(sr)
                          setRejectRemarks('')
                          setShowRejectInput(false)
                          setShowReviewModal(true)
                        }}
                        icon={<Eye size={14} />}
                      >
                        Review
                      </Button>
                      {sr.approved_pdf_url && (
                        <Button
                          variant="ghost"
                          color="danger"
                          size="sm"
                          onClick={() => { setPreviewUrl(sr.approved_pdf_url); setShowPreviewModal(true) }}
                          title="Preview Signed PDF"
                          icon={<FileText size={16} />}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provincial Review Modal */}
      {showReviewModal && reviewSitRep && (
        <HeaderFooterModal
          isOpen={showReviewModal}
          onClose={() => !processingReview && setShowReviewModal(false)}
          title={`Review: ${reviewSitRep.title}`}
          subtitle="Review the signed PDF below, then Approve or Reject it."
          maxWidth="1100px"
          footer={
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', width: '100%' }}>
              <Button variant="subtle" onClick={() => setShowReviewModal(false)} disabled={processingReview}>
                Cancel
              </Button>
              {!showRejectInput ? (
                <Button variant="outline" color="danger" onClick={() => setShowRejectInput(true)} disabled={processingReview} icon={<X size={18} />}>
                  Reject
                </Button>
              ) : (
                <Button variant="solid" color="danger" onClick={handleReject} isLoading={processingReview} disabled={!rejectRemarks.trim()}>
                  Confirm Rejection
                </Button>
              )}
              <Button variant="solid" color="primary" onClick={handleApprove} isLoading={processingReview} disabled={showRejectInput} icon={<CheckCircle size={18} />}>
                Approve
              </Button>
            </div>
          }
        >
          <div className="review-modal-content" style={{ display: 'flex', flexDirection: 'column', height: '70vh', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event</label>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{reviewSitRep.events?.name}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Province</label>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{reviewSitRep.province}</div>
              </div>
            </div>
            {reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url ? (
              <div style={{ flex: 1, background: '#e2e8f0', overflow: 'hidden', minHeight: 0, borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <iframe
                  src={`${reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url}#toolbar=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="PDF Review"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', color: '#9a3412', flex: 1, justifyContent: 'center' }}>
                <Info size={24} />
                <span style={{ fontSize: '1rem', fontWeight: 500 }}>No signed PDF was uploaded with this report.</span>
              </div>
            )}
            {showRejectInput && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Rejection Remarks *</label>
                <textarea
                  className="modern-textarea"
                  style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #ef4444', fontSize: '0.875rem', outline: 'none', resize: 'none' }}
                  placeholder="Explain why this report is being rejected..."
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
        </HeaderFooterModal>
      )}

      {/* PDF Preview Modal */}
      {showPreviewModal && (
        <HeaderFooterModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="PDF Preview"
          maxWidth="900px"
        >
          <iframe src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} title="PDF Preview" />
        </HeaderFooterModal>
      )}
    </div>
  )
}
