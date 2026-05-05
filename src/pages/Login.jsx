import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Eye, EyeClosed } from '@phosphor-icons/react'
import LoadingSpinner from '../components/LoadingSpinner'
import { supabase } from '../lib/supabase'
import { hashPassword } from '../lib/passwordUtils'
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
    if (!supabase) {
      setError('Database not configured.')
      return
    }
    setSubmitting(true)
    try {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      
      console.log('[Login Debug] Email:', email.trim().toLowerCase())
      console.log('[Login Debug] User found:', !!user)
      
      if (fetchError) throw fetchError
      if (!user) {
        setError('Invalid email or password.')
        setSubmitting(false)
        return
      }

      const hashed = await hashPassword(password, email.trim().toLowerCase())
      console.log('[Login Debug] Hashed Input:', hashed)
      console.log('[Login Debug] Stored Hash:', user.password_hash)
      console.log('[Login Debug] Match:', hashed === user.password_hash)

      if (user.password_hash !== hashed) {
        setError('Invalid email or password.')
        setSubmitting(false)
        return
      }
      if (user.status === 'Inactive') {
        setError('Account is inactive.')
        setSubmitting(false)
        return
      }
      // Log successful login
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'Logged in',
        details: 'User authenticated successfully'
      })

      // Strip sensitive fields before storing in session
      const { password_hash: _ph, ...safeUser } = user
      onLogin?.(safeUser)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('[Login] error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <FileText className="login-logo" size={28} />
          <h1>RDRMS C1</h1>
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
    </div>
  )
}
