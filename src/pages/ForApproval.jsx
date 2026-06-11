import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { 
  CheckCircle, 
  Eye, 
  FileText, 
  Info,
  CaretDown,
  Warning
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
  const { showSuccess, showConfirm, showToast } = useEvents()

  const isLguApprover = user?.account_type === 'LGU Approver'
  const isSuperAdmin = user?.role === 'Super Admin' || user?.account_type === 'Super Admin'

  const [sitreps, setSitreps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewSitRep, setReviewSitRep] = useState(null)
  const [processingReview, setProcessingReview] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(true)
  const [previewUrl, setPreviewUrl] = useState(null)

  const fetchPendingSitreps = async () => {
    if (!user || isLguApprover) return
    setLoading(true)
    try {
      const { data } = await api.get('/situational-reports', { params: { status: 'Pending Approval' } })
      setSitreps(data || [])
    } catch (err) {
      console.error('Error fetching pending sitreps:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingSitreps()
  }, [user, isLguApprover])

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
          showSuccess('Approved', `"${reviewSitRep.title}" has been approved successfully.`)
          fetchPendingSitreps()
        } catch (err) {
          showToast('Error', err.response?.data?.error || err.message || 'Failed to approve report.', 'danger')
        } finally {
          setProcessingReview(false)
        }
      }
    })
  }

  if (isLguApprover) {
    return (
      <div className="page for-approval-page">
        <div className="consolidated-report-card">
          <div className="consolidated-report-toolbar">
            <div className="consolidated-report-header-stack">
              <h1 className="consolidated-report-title">LGU Submissions</h1>
              <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                LGU data is submitted directly without approval gate.
              </p>
            </div>
          </div>
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <CheckCircle size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
            <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>No Approval Required</h3>
            <p style={{ fontSize: '0.875rem' }}>LGU data submissions are now direct. They are immediately visible to Provincial and Regional users upon submission.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page for-approval-page">
      <div className="consolidated-report-card">
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            <h1 className="consolidated-report-title">Reports for Approval</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
              Review and approve provincial reports.
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
                    <td className="event-date-cell">{new Date(sr.created_at).toLocaleDateString()}</td>
                    <td className="col-action" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <Button
                        variant="solid"
                        color="primary"
                        size="sm"
                        onClick={() => { setReviewSitRep(sr); setShowReviewModal(true) }}
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
              <Button variant="solid" color="primary" onClick={handleApprove} isLoading={processingReview} icon={<CheckCircle size={18} />}>
                Approve
              </Button>
            </div>
          }
        >
          <div className="review-modal-content" style={{ display: 'flex', height: '70vh', gap: '1.5rem', minHeight: 0 }}>
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
              <div style={{ flex: 1, background: '#e2e8f0', overflow: 'hidden', minHeight: 0, borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                {(reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url) ? (
                  <iframe
                    src={`${reviewSitRep.pending_pdf_url || reviewSitRep.approved_pdf_url}#toolbar=0`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="PDF Review"
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event</label>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginTop: '0.25rem' }}>{reviewSitRep.events?.name}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Province / Scope</label>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginTop: '0.25rem' }}>{reviewSitRep.province || 'Regional'}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</label>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span className={`status-pill status-${(reviewSitRep.status || 'draft').toLowerCase().replace(/\s+/g, '-')}`}>
                      {reviewSitRep.status}
                    </span>
                  </div>
                </div>
              </div>

              {!reviewSitRep.pending_pdf_url && !reviewSitRep.approved_pdf_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', color: '#9a3412' }}>
                  <Info size={24} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>No signed PDF was uploaded with this report. Please verify before approving.</span>
                </div>
              )}

              {reviewSitRep.rejection_remarks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Previous Rejection Remarks</span>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>{reviewSitRep.rejection_remarks}</p>
                </div>
              )}
            </div>
          </div>
        </HeaderFooterModal>
      )}

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
