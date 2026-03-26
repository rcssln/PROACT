import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForcePasswordChange from './pages/ForcePasswordChange'
import Dashboard from './pages/Dashboard'
import AddReport from './pages/AddReport'

import Users from './pages/Users'
import ConsolidatedReport from './pages/ConsolidatedReport'
import EventLogs from './pages/EventLogs'
import ManageEvents from './pages/ManageEvents'
import { EventProvider } from './contexts/EventContext'
import LoadingSpinner from './components/LoadingSpinner'
import { supabase } from './lib/supabase'
import './styles/App.css'

/** Strip any sensitive fields before we write the user to sessionStorage. */
function sanitizeUser(user) {
  if (!user) return null
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...safe } = user
  return safe
}

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const saved = sessionStorage.getItem('report_system_user')
      if (!saved) {
        setIsLoading(false)
        return
      }

      let parsed
      try {
        parsed = JSON.parse(saved)
      } catch {
        sessionStorage.removeItem('report_system_user')
        setIsLoading(false)
        return
      }

      // Re-validate against the DB so a tampered role/status is never trusted
      if (supabase && parsed?.id) {
        const { data: fresh, error } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, status, account_type, province, city, must_change_password, created_at')
          .eq('id', parsed.id)
          .maybeSingle()

        if (error || !fresh || fresh.status === 'Inactive') {
          // Session is stale or account deactivated — force logout
          sessionStorage.removeItem('report_system_user')
          setIsLoading(false)
          return
        }

        const sanitized = sanitizeUser(fresh)
        sessionStorage.setItem('report_system_user', JSON.stringify(sanitized))
        setUser(sanitized)
      } else {
        setUser(sanitizeUser(parsed))
      }

      setIsLoading(false)
    }

    restoreSession()
  }, [])

  const isAuthenticated = !!user

  const handleLogin = (loggedInUser) => {
    if (loggedInUser) {
      const sanitized = sanitizeUser(loggedInUser)
      sessionStorage.setItem('report_system_user', JSON.stringify(sanitized))
      setUser(sanitized)
    } else {
      sessionStorage.removeItem('report_system_user')
      setUser(null)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('report_system_user')
    setUser(null)
  }

  if (isLoading) {
    return <LoadingSpinner label="Authenticating session..." />
  }

  return (
    <BrowserRouter>
      <EventProvider user={user}>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <>
                  <Layout user={user} onLogout={handleLogout} />
                  {user.must_change_password && (
                    <ForcePasswordChange user={user} onLogout={handleLogout} />
                  )}
                </>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Navigate to="/login" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="add-report" element={<AddReport />} />
            <Route path="users" element={<Users />} />
            <Route path="consolidated-report" element={<ConsolidatedReport />} />
            <Route path="event-logs" element={<EventLogs />} />
            <Route path="manage-events" element={<ManageEvents />} />
          </Route>
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </EventProvider>
    </BrowserRouter>
  )
}

export default App
