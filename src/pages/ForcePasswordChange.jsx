import { useState } from 'react'
import { ShieldWarning, Eye, EyeClosed } from '@phosphor-icons/react'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'
import { validatePassword, getPasswordRules } from '../lib/passwordUtils'
import { useEvents } from '../contexts/EventContext'
import Button from '../components/Button'
import '../styles/pages/ForcePasswordChange.css'

export default function ForcePasswordChange({ user, onLogout }) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const { showConfirm } = useEvents()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        const pwdValidation = validatePassword(password)
        if (!pwdValidation.valid) {
            setError(pwdValidation.message)
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        showConfirm({
            title: 'Update Password',
            message: 'Are you sure you want to update your password? You will be logged out and need to sign in again with your new password.',
            onConfirm: async () => {
                setSubmitting(true)

                try {
                    await api.post('/api/auth/change-password', {
                        newPassword: password
                    })

                    // Log the action
                    await api.post('/api/activity-logs', {
                        action: 'Changed password',
                        details: 'Forced password change on first login'
                    })

                    // Force logout on successful password change
                    onLogout()

                } catch (err) {
                    setError(err.response?.data?.error || err.message || 'Failed to update password.')
                    setSubmitting(false)
                }
            }
        })
    }

    return (
        <div className="force-pwd-page">
            <div className="force-pwd-card">
                <div className="force-pwd-header">
                    <ShieldWarning className="force-pwd-logo" size={32} />
                    <h1>Update Required</h1>
                    <p>For security reasons, you must change your temporary password before continuing.</p>
                </div>

                <form onSubmit={handleSubmit} className="force-pwd-form">
                    <div className="form-group">
                        <label htmlFor="new-password">New Password</label>
                        <div className="password-input-wrap">
                            <input
                                id="new-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="At least 8 characters, uppercase and lowercase"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <div className="password-input-wrap">
                            <input
                                id="confirm-password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Re-enter new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && (
                            <span className={password === confirmPassword ? 'confirm-ok' : 'confirm-error'}>
                                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                            </span>
                        )}
                    </div>

                    {error && (
                        <div className="force-pwd-error" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="force-pwd-actions">
                        <button type="button" className="btn-logout" onClick={onLogout} disabled={submitting}>
                            Logout
                        </button>
                        <Button type="submit" className="btn-submit" isLoading={submitting}>
                            Update Password
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
