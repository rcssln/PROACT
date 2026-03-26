import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Shield, Palette, Bell, Eye, EyeOff, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hashPassword, validatePassword } from '../lib/passwordUtils'
import LoadingSpinner from './LoadingSpinner'
import Button from './Button'
import SearchableSelect from './SearchableSelect'

export default function SettingsModal({ isOpen, onClose, user, onLogout }) {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('security')
    const [notifications, setNotifications] = useState(true)
    const [emailAlerts, setEmailAlerts] = useState(true)

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [pwdError, setPwdError] = useState('')
    const [pwdSuccess, setPwdSuccess] = useState('')
    const [submittingPwd, setSubmittingPwd] = useState(false)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setPwdError('')
            setPwdSuccess('')
            setActiveTab('security')
        }
    }, [isOpen])

    if (!isOpen) return null

    // Escape key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

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

        if (!supabase || !user) {
            setPwdError('Database not configured or user not found.')
            return
        }

        setSubmittingPwd(true)

        try {
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('password_hash')
                .eq('id', user.id)
                .single()

            if (fetchError || !userData) {
                throw new Error('Failed to verify current password.')
            }

            const currentHashInput = await hashPassword(currentPassword)
            if (currentHashInput !== userData.password_hash) {
                throw new Error('Current password is incorrect.')
            }

            const newHash = await hashPassword(newPassword)

            // Update the db
            const { error: updateError } = await supabase
                .from('users')
                .update({ password_hash: newHash })
                .eq('id', user.id)

            if (updateError) throw updateError

            // Log the action
            await supabase
                .from('activity_logs')
                .insert({
                    user_id: user.id,
                    action: 'Changed password',
                    details: 'User voluntarily changed password via Settings Modal'
                })

            setPwdSuccess('Password changed successfully! Logging out...')

            // Force logout
            setTimeout(() => {
                onLogout?.()
            }, 1500)

        } catch (err) {
            setPwdError(err.message || 'Error changing password.')
        } finally {
            setSubmittingPwd(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '650px',
                    height: '520px',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="modal-header">
                    <div>
                        <h2>Settings & Profile</h2>
                        <div className="modal-header-subtitle">
                            {user?.email} • <span className="text-primary">{user?.account_type || user?.role}</span>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

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
                            onClick={() => setActiveTab('notifications')}
                            className={`modal-sidebar-tab ${activeTab === 'notifications' ? 'active' : ''}`}
                        >
                            <Bell size={16} /> Notifications
                        </button>
                        <button
                            onClick={() => {
                                onClose()
                                navigate('/event-logs')
                            }}
                            className="modal-sidebar-tab"
                        >
                            <History size={16} /> Event Logs
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`modal-sidebar-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                        >
                            <Palette size={16} /> Appearance
                        </button>
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
                                                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
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
                                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
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
                                        className="modal-btn-primary"
                                        isLoading={submittingPwd}
                                        style={{ width: '100%' }}
                                    >
                                        Update Password
                                    </Button>
                                </form>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="settings-tab-pane">
                                <h3 className="settings-section-title">Notification Preferences</h3>

                                <div className="settings-toggle-row">
                                    <div className="settings-toggle-info">
                                        <div className="settings-toggle-title">Push Notifications</div>
                                        <div className="settings-toggle-desc">Receive browser notifications for new reports</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                <div className="settings-toggle-row last">
                                    <div className="settings-toggle-info">
                                        <div className="settings-toggle-title">Email Alerts</div>
                                        <div className="settings-toggle-desc">Get email updates for important consolidated reports</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="settings-tab-pane">
                                <h3 className="settings-section-title">Appearance Settings</h3>

                                <div className="form-group">
                                    <label className="settings-label">Theme Mode</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'light', label: 'Light Theme (Default)' },
                                            { value: 'dark', label: 'Dark Theme' },
                                            { value: 'system', label: 'System Default' }
                                        ]}
                                        value="light"
                                        onChange={(e) => console.log('Theme changed:', e.target.value)}
                                        placeholder="Select Theme"
                                    />
                                    <p className="settings-section-desc mt-2">
                                        Dark mode helps reduce eye strain in low-light environments.
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}
