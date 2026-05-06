import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Shield, Palette, Eye, EyeClosed, ClockCounterClockwise, Info, Database, DownloadSimple, UploadSimple, WarningCircle, FileZip } from '@phosphor-icons/react'
import { zip, unzip, strToU8, strFromU8 } from 'fflate'
import pkg from '../../package.json'

import api from '../lib/api'
import { validatePassword } from '../lib/passwordUtils'
import LoadingSpinner from './LoadingSpinner'
import Button from './Button'
import SearchableSelect from './SearchableSelect'
import HeaderFooterModal from './HeaderFooterModal'

export default function SettingsModal({ isOpen, onClose, user, onLogout, onUserUpdate }) {
    const navigate = useNavigate()

    const [activeTab, setActiveTab] = useState('security')

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [pwdError, setPwdError] = useState('')
    const [pwdSuccess, setPwdSuccess] = useState('')
    const [submittingPwd, setSubmittingPwd] = useState(false)

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'classic')
    
    // Maintenance State
    const [maintenanceLoading, setMaintenanceLoading] = useState(false)
    const [maintenanceError, setMaintenanceError] = useState('')
    const [maintenanceSuccess, setMaintenanceSuccess] = useState('')
    const [maintenanceProgress, setMaintenanceProgress] = useState('')
    
    const isSuperAdmin = user?.role === 'Super Admin' || user?.account_type === 'Super Admin'

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setPwdError('')
            setPwdSuccess('')
            setActiveTab('security')
            setTheme(localStorage.getItem('theme') || 'classic')
            setMaintenanceError('')
            setMaintenanceSuccess('')
            setMaintenanceProgress('')
        }
    }, [isOpen])

    const handleThemeChange = async (newTheme) => {
        setTheme(newTheme)
        
        // Apply immediately for smooth UX
        document.documentElement.setAttribute('data-theme', newTheme)
        
        if (user?.id) {
            try {
                await api.patch(`/api/users/${user.id}`, { theme: newTheme })
                // Update global state and session
                onUserUpdate?.({ ...user, theme: newTheme })
            } catch (err) {
                console.error('[Settings] Failed to save theme:', err)
            }
        } else {
            localStorage.setItem('theme', newTheme)
        }
    }

    const handlePasswordSubmit = async (e) => {
        e.preventDefault()
        setPwdError('')
        setPwdSuccess('')

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setPwdError('Please fill in all password fields.')
            return
        }

        if (newPassword !== confirmNewPassword) {
            setPwdError('New passwords do not match.')
            return
        }

        const pwdValidation = validatePassword(newPassword)
        if (!pwdValidation.valid) {
            setPwdError(pwdValidation.message)
            return
        }

        if (!user) {
            setPwdError('User not found.')
            return
        }

        setSubmittingPwd(true)

        try {
            await api.post('/api/auth/change-password', {
                currentPassword,
                newPassword
            })

            setPwdSuccess('Password changed successfully! Logging out...')

            // Force logout
            setTimeout(() => {
                onLogout?.()
            }, 1500)

        } catch (err) {
            setPwdError(err.response?.data?.error || err.message || 'Error changing password.')
        } finally {
            setSubmittingPwd(false)
        }
    }

    const handleBackup = async () => {
        alert('System backup is unavailable in local database mode.')
    }

    const handleRestore = async (file) => {
        alert('System restore is unavailable in local database mode.')
    }

    if (!isOpen) return null

    // Escape key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    return (
        <HeaderFooterModal
            isOpen={isOpen}
            onClose={onClose}
            title="Settings & Profile"
            subtitle={<>{user?.email} • <span className="text-primary">{user?.account_type || user?.role}</span></>}
            maxWidth="650px"
            bodyPadding="0"
            className="settings-modal-content"
        >
            <div className="modal-body-p0" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Modal Sidebar Tabs */}
                <div className="modal-sidebar">
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`modal-sidebar-tab ${activeTab === 'security' ? 'active' : ''}`}
                    >
                        <Shield size={16} /> Security
                    </button>

                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`modal-sidebar-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                    >
                        <Palette size={16} /> Appearance
                    </button>

                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('maintenance')}
                            className={`modal-sidebar-tab ${activeTab === 'maintenance' ? 'active' : ''}`}
                        >
                            <Database size={16} /> Maintenance
                        </button>
                    )}

                    <button
                        onClick={() => {
                            onClose()
                            navigate('/event-logs')
                        }}
                        className="modal-sidebar-tab"
                    >
                        <ClockCounterClockwise size={16} /> Event Logs
                    </button>
                    <button
                        onClick={() => {
                            navigate('/manual')
                            onClose()
                        }}
                        className="modal-sidebar-tab"
                    >
                        <Info size={16} /> Help & Manual
                    </button>

                    <div className="modal-sidebar-footer">
                        <div className="modal-version-text">
                            Version {pkg.version}
                        </div>
                    </div>
                </div>

                {/* Modal Content Area */}
                <div className="modal-body-content">
                    {activeTab === 'security' && (
                        <div className="settings-tab-pane">
                            <h3 className="settings-section-title">Change Password</h3>
                            <p className="settings-section-desc">Ensure your account is using a long, random password to stay secure.</p>

                            <form onSubmit={handlePasswordSubmit}>
                                <div className="form-group">
                                    <label className="settings-label">Current Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showCurrent ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="event-modal-input"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="password-toggle-btn">
                                            {showCurrent ? <EyeClosed size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="settings-label">New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="At least 8 chars, uppercase & lowercase"
                                            className="event-modal-input"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowNew(!showNew)} className="password-toggle-btn">
                                            {showNew ? <EyeClosed size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="settings-label">Confirm New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="event-modal-input"
                                            required
                                        />
                                    </div>
                                </div>

                                {pwdError && <div className="settings-error-msg">{pwdError}</div>}
                                {pwdSuccess && <div className="settings-success-msg">{pwdSuccess}</div>}

                                <Button
                                    type="submit"
                                    variant="solid"
                                    color="primary"
                                    isLoading={submittingPwd}
                                    style={{ width: '100%' }}
                                >
                                    Update Password
                                </Button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings-tab-pane">
                            <h3 className="settings-section-title">UI Theme</h3>
                            <p className="settings-section-desc">Choose between the classic interface or the modern style guide palette.</p>
                            
                            <div className="theme-selector-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                                <div 
                                    className={`theme-option-card ${theme === 'classic' ? 'active' : ''}`}
                                    onClick={() => handleThemeChange('classic')}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '2px solid',
                                        borderColor: theme === 'classic' ? 'var(--accent)' : 'var(--border-color)',
                                        cursor: 'pointer',
                                        background: theme === 'classic' ? 'var(--accent-glow)' : 'transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Classic</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard PROACT interface colors</div>
                                </div>

                                <div 
                                    className={`theme-option-card ${theme === 'modern' ? 'active' : ''}`}
                                    onClick={() => handleThemeChange('modern')}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '2px solid',
                                        borderColor: theme === 'modern' ? 'var(--accent)' : 'var(--border-color)',
                                        cursor: 'pointer',
                                        background: theme === 'modern' ? 'var(--accent-glow)' : 'transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Modern</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vibrant blue & style guide palette</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'maintenance' && isSuperAdmin && (
                        <div className="settings-tab-pane">
                            <h3 className="settings-section-title">Maintenance</h3>
                            <p className="settings-section-desc">Backup and restore system data including database records and uploaded files. This action is irreversible.</p>
                            
                            <div className="maintenance-actions-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                                <div className="maintenance-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <DownloadSimple size={24} weight="bold" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Full System Backup</h4>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Export all data and PDFs to a ZIP archive.</p>
                                    </div>
                                    <Button variant="solid" color="primary" onClick={handleBackup} isLoading={maintenanceLoading}>
                                        Backup Now
                                    </Button>
                                </div>

                                <div className="maintenance-card danger" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <UploadSimple size={24} weight="bold" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Restore from Backup</h4>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Restore the system using a previously saved ZIP.</p>
                                    </div>
                                    <div>
                                        <input 
                                            type="file" 
                                            id="restore-file" 
                                            accept=".zip" 
                                            onChange={(e) => handleRestore(e.target.files[0])} 
                                            style={{ display: 'none' }}
                                        />
                                        <Button variant="outline" color="danger" onClick={() => document.getElementById('restore-file').click()} isLoading={maintenanceLoading}>
                                            Restore Now
                                        </Button>
                                    </div>
                                </div>

                                {(maintenanceProgress || maintenanceError || maintenanceSuccess) && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: maintenanceError ? '#fef2f2' : (maintenanceSuccess ? '#f0fdf4' : '#f8fafc'), border: '1px solid', borderColor: maintenanceError ? '#fee2e2' : (maintenanceSuccess ? '#dcfce7' : '#e2e8f0') }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', fontWeight: 600, color: maintenanceError ? '#ef4444' : (maintenanceSuccess ? '#15803d' : 'var(--text-muted)') }}>
                                            {maintenanceLoading && <div className="spinner-small" style={{ width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.1)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>}
                                            {maintenanceError && <WarningCircle size={18} />}
                                            {maintenanceProgress || maintenanceError || maintenanceSuccess}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </HeaderFooterModal>
    )
}
