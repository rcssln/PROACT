import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Shield, Palette, Eye, EyeClosed, ClockCounterClockwise, Info, Database, DownloadSimple, UploadSimple, WarningCircle, FileZip, Envelope } from '@phosphor-icons/react'
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

    // Email Config state
    const [emailConfig, setEmailConfig] = useState({
        provider: 'Outlook',
        senderEmail: '',
        host: 'smtp.office365.com',
        port: 587,
        username: '',
        password: ''
    })
    const [emailLoading, setEmailLoading] = useState(false)
    const [emailError, setEmailError] = useState(null)
    const [emailSuccess, setEmailSuccess] = useState(false)

    const fetchEmailConfig = async () => {
        try {
            setEmailLoading(true)
            const { data } = await api.get('/settings/smtp')
            if (data && Object.keys(data).length > 0) {
                setEmailConfig(data)
            }
        } catch (err) {
            console.error('Failed to fetch email config', err)
        } finally {
            setEmailLoading(false)
        }
    }

    const handleSaveEmailConfig = async () => {
        try {
            setEmailLoading(true)
            setEmailError(null)
            setEmailSuccess(false)
            
            // Basic validation
            if (!emailConfig.username || !emailConfig.password || !emailConfig.host) {
                setEmailError('Please fill in Host, Username, and Password.')
                setEmailLoading(false)
                return
            }

            const { data } = await api.put('/settings/smtp', emailConfig)
            if (data.success) {
                setEmailSuccess('Email configuration saved successfully.')
            } else {
                setEmailError('Failed to save configuration.')
            }
        } catch (err) {
            console.error('Save failed:', err)
            const msg = err.response?.data?.error || err.message || 'Server error'
            setEmailError(`Failed: ${msg}`)
        } finally {
            setEmailLoading(false)
        }
    }

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
            setEmailError(null)
            setEmailSuccess(false)
        }
    }, [isOpen])

    useEffect(() => {
        if (isOpen && isSuperAdmin && activeTab === 'email') {
            fetchEmailConfig()
        }
    }, [isOpen, activeTab, isSuperAdmin])

    const handleThemeChange = async (newTheme) => {
        setTheme(newTheme)
        
        // Apply immediately for smooth UX
        document.documentElement.setAttribute('data-theme', newTheme)
        
        if (user?.id) {
            try {
                await api.patch(`/users/${user.id}`, { theme: newTheme })
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
            await api.post('/auth/change-password', {
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

                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('email')}
                            className={`modal-sidebar-tab ${activeTab === 'email' ? 'active' : ''}`}
                        >
                            <Envelope size={16} /> Email Config
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
                            <p className="settings-section-desc">The Modern Style Guide Palette.</p>
                            
                            <div className="theme-selector-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem' }}>
                                {/* <div  
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
                                </div> */}

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

                                {/* NEW: Dark Mode
                                <div 
                                    className={`theme-option-card ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => handleThemeChange('dark')}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '2px solid',
                                        borderColor: theme === 'dark' ? '#6366f1' : 'var(--border-color)',
                                        cursor: 'pointer',
                                        background: theme === 'dark' ? '#1e1b4b' : '#0f172a',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#e2e8f0' }}>Dark</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dark background, light text</div>
                                </div> */}
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

                    {activeTab === 'email' && isSuperAdmin && (
                        <div className="settings-tab-pane">
                            <h3 className="settings-section-title">SMTP Configuration</h3>
                            <p className="settings-section-desc">
                                Configure the email provider and credentials used by the system to send welcome and verification emails.
                            </p>
                            
                            {emailError && <div className="settings-error-msg">{emailError}</div>}
                            {emailSuccess && typeof emailSuccess === 'string' && <div className="settings-success-msg">{emailSuccess}</div>}
                            
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveEmailConfig() }} className="settings-form">
                                <div className="form-group">
                                    <label>Email Provider</label>
                                    <select 
                                        className="settings-input"
                                        value={emailConfig.provider} 
                                        onChange={e => setEmailConfig({...emailConfig, provider: e.target.value})}
                                    >
                                        <option value="Outlook">Outlook / Office 365</option>
                                        <option value="Gmail">Gmail</option>
                                        <option value="Custom">Custom SMTP</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Sender Email Address (Optional Display)</label>
                                    <input
                                        type="email"
                                        className="settings-input"
                                        placeholder="e.g. noreply@dost.gov.ph"
                                        value={emailConfig.senderEmail}
                                        onChange={e => setEmailConfig({...emailConfig, senderEmail: e.target.value})}
                                    />
                                    <span className="settings-hint">The system will try to mask the sender with this address (Note: Some providers restrict this).</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '15px' }}>
                                    <div className="form-group">
                                        <label>SMTP Host</label>
                                        <input
                                            type="text"
                                            className="settings-input"
                                            placeholder="e.g. smtp.office365.com"
                                            value={emailConfig.host}
                                            onChange={e => setEmailConfig({...emailConfig, host: e.target.value})}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Port</label>
                                        <input
                                            type="number"
                                            className="settings-input"
                                            value={emailConfig.port}
                                            onChange={e => setEmailConfig({...emailConfig, port: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Authentication Username (Email)</label>
                                    <input
                                        type="text"
                                        className="settings-input"
                                        placeholder="e.g. admin@proact.local"
                                        value={emailConfig.username}
                                        onChange={e => setEmailConfig({...emailConfig, username: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Authentication Password / App Password</label>
                                    <input
                                        type="password"
                                        className="settings-input"
                                        placeholder="Enter password"
                                        value={emailConfig.password}
                                        onChange={e => setEmailConfig({...emailConfig, password: e.target.value})}
                                        required
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    variant="solid" 
                                    color="primary" 
                                    isLoading={emailLoading}
                                    style={{ marginTop: '10px' }}
                                >
                                    Save Email Settings
                                </Button>
                            </form>
                        </div>
                    )}
                </div>

            </div>
        </HeaderFooterModal>
    )
}
