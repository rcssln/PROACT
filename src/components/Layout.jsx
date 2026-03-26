import { Outlet, useLocation } from 'react-router-dom'
import { EventProvider } from '../contexts/EventContext'
import Sidebar from './Sidebar'
import '../styles/components/Layout.css'

export default function Layout({ user, onLogout }) {
  const { pathname } = useLocation()
  const isDashboard = pathname === '/dashboard' || pathname === '/' || pathname === ''

  return (
    <div className="layout">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`main-content ${isDashboard ? 'main-content--scrollable' : ''}`}>
        <Outlet context={{ user }} />
      </main>
    </div>
  )
}
