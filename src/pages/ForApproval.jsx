import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { 
  CheckCircle, 
  Eye, 
  FileText, 
  Info
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
  const { showSuccess, showConfirm } = useEvents()

  const isLguApprover = user?.account_type === 'LGU Approver'
  const isSuperAdmin = user?.role === 'Super Admin' || user?.account_type === 'Super Admin'

  const [sitreps, setSitreps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewSitRep, setReviewSitRep] = useState(null)
  const [processingReview, setProcessingReview] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
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
          showSuccess('Error', err.response?.data?.error || err.message || 'Failed to approve report.')
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
