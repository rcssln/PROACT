import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Eye, EyeClosed } from '@phosphor-icons/react'
import api from '../lib/api'
import Button from '../components/Button'
import '../styles/pages/Login.css'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email?.trim() || !password) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password
      })

      // Store JWT and user in localStorage
      localStorage.setItem('proact_token', data.token)
      localStorage.setItem('proact_user', JSON.stringify(data.user))

      // Log successful login (fire and forget)
      api.post('/activity-logs', {
        action: 'Logged in',
        details: 'User authenticated successfully'
      }).catch(() => {})

      onLogin?.(data.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/asset1-logo.svg" alt="SIREN Logo" className="login-logo-img" />
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group password-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeClosed size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" className="login-btn" isLoading={submitting}>
            Sign In
          </Button>
        </form>
      </div>
      <div className="login-footer">
        Developed by DOST DRRM Unit OJT <span className="highlight-name">Joaquin Patongan</span>
      </div>
    </div>
  )
}
