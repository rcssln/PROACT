import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ForcePasswordChange from '../pages/ForcePasswordChange'
import '../styles/components/Layout.css'

export default function Layout({ user, onLogout, onUserUpdate }) {
  const { pathname } = useLocation()
  const isDashboard = pathname === '/dashboard' || pathname === '/' || pathname === ''

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed)
  }, [isCollapsed])

  useEffect(() => {
    const savedTheme = user?.theme || localStorage.getItem('theme') || 'classic'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [user?.theme])


  const toggleSidebar = () => setIsCollapsed(prev => !prev)

  return (
    <div className={`layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        onUserUpdate={onUserUpdate}
        isCollapsed={isCollapsed} 
        onToggle={toggleSidebar} 
      />

      <main className={`main-content ${isDashboard ? 'main-content--scrollable' : ''}`}>
        <Outlet context={{ user }} />
        {user?.must_change_password && (
          <ForcePasswordChange user={user} onLogout={onLogout} />
        )}
      </main>
    </div>
  )
}