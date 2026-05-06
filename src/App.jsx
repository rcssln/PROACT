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
import ForApproval from './pages/ForApproval'
import Manual from './pages/Manual'
import { EventProvider } from './contexts/EventContext'
import MeshBackground from './components/MeshGradient'
import LoadingSpinner from './components/LoadingSpinner'
import api from './lib/api'
import './styles/App.css'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('proact_token')
      const savedUser = localStorage.getItem('proact_user')

      if (!token || !savedUser) {
        setIsLoading(false)
        return
      }

      try {
        // Re-validate against the backend so tampered roles are never trusted
        const { data: fresh } = await api.get('/api/auth/me')
        if (!fresh || fresh.status === 'Inactive') {
          localStorage.removeItem('proact_token')
          localStorage.removeItem('proact_user')
          setIsLoading(false)
          return
        }
        localStorage.setItem('proact_user', JSON.stringify(fresh))
        setUser(fresh)
      } catch {
        // Token expired or invalid
        localStorage.removeItem('proact_token')
        localStorage.removeItem('proact_user')
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const isAuthenticated = !!user

  const handleLogin = (loggedInUser) => {
    if (loggedInUser) {
      setUser(loggedInUser)
    } else {
      localStorage.removeItem('proact_token')
      localStorage.removeItem('proact_user')
      setUser(null)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('proact_token')
    localStorage.removeItem('proact_user')
    localStorage.removeItem('selectedEventId')
    setUser(null)
  }

  const handleUserUpdate = (updatedUser) => {
    localStorage.setItem('proact_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  if (isLoading) {
    return <LoadingSpinner label="Authenticating session..." />
  }

  return (
    <BrowserRouter>
      <MeshBackground />
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
                <Layout user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="add-report" element={<AddReport />} />
            <Route path="users" element={<Users />} />
            <Route path="consolidated-report" element={<ConsolidatedReport />} />
            <Route path="event-logs" element={<EventLogs />} />
            <Route path="manage-events" element={<ManageEvents />} />
            <Route path="for-approval" element={<ForApproval />} />
            <Route path="manual" element={<Manual />} />
          </Route>
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </EventProvider>
    </BrowserRouter>
  )
}

export default App
