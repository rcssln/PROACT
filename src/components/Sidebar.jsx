import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FilePlus,
  Users,
  Settings,
  LogOut,
  FileText,
  FileBarChart,
  User,
} from 'lucide-react'
import { useEvents } from '../contexts/EventContext'
import SettingsModal from './SettingsModal'
import '../styles/components/Sidebar.css'

export default function Sidebar({ user, onLogout }) {
  const isProvincial = user?.account_type === 'Provincial'
  const isRegional = user?.account_type === 'Regional'
  const navigate = useNavigate()
  const location = useLocation()
  const { currentEvent, notifications, pendingUsersCount } = useEvents()
  
  const unreadNotifs = notifications?.filter(n => !n.is_read) || []
  
  const getNavCount = (path) => {
    switch(path) {
      case '/dashboard':
        return unreadNotifs.filter(n => n.type === 'event_deployment').length
      case '/consolidated-report':
        return unreadNotifs.filter(n => n.type === 'sitrep_submission' || n.type === 'sitrep_approval').length
      case '/add-report':
        return unreadNotifs.filter(n => 
          n.type === 'sitrep_rejection' || 
          n.type === 'sitrep_assignment' || 
          n.type === 'sitrep_submission' || 
          n.type === 'sitrep_approval'
        ).length
      case '/users':
        return pendingUsersCount || 0
      default:
        return 0
    }
  }

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const displayName = user?.first_name || user?.name || user?.email || 'User'

  const openLogoutModal = () => setShowLogoutModal(true)
  const closeLogoutModal = () => setShowLogoutModal(false)

  const confirmLogout = () => {
    closeLogoutModal()
    onLogout?.()
    navigate('/login', { replace: true })
  }



  useEffect(() => {
    if (!showLogoutModal) return
    const onEscape = (e) => {
      if (e.key === 'Escape') closeLogoutModal()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [showLogoutModal])

  const navItemsAfterAddReport = [
    { to: '/users', icon: Users, label: 'Users' },
  ]



  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="Logo" className="sidebar-logo-image" />
        <h1 className="sidebar-title">RDRRMC1 <br /> Reporting System </h1>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={16} strokeWidth={2} />
          <span>Dashboard</span>
          {getNavCount('/dashboard') > 0 && (
            <span className="sidebar-nav-badge">{getNavCount('/dashboard')}</span>
          )}
        </NavLink>
        {(isRegional || user?.account_type === 'Super Admin' || user?.role === 'Super Admin') && (
          <NavLink
            to="/manage-events"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={16} strokeWidth={2} />
            <span>Manage Events</span>
            {getNavCount('/manage-events') > 0 && (
              <span className="sidebar-nav-badge">{getNavCount('/manage-events')}</span>
            )}
          </NavLink>
        )}
        {(isProvincial || isRegional || user?.account_type === 'Provincial Approver' || user?.account_type === 'Super Admin' || user?.role === 'Super Admin') && (
          <div className="sidebar-nav-group">
            <NavLink
              to="/consolidated-report"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <FileBarChart size={16} strokeWidth={2} />
              <span>Consolidated Report</span>
              {getNavCount('/consolidated-report') > 0 && (
                <span className="sidebar-nav-badge">{getNavCount('/consolidated-report')}</span>
              )}
            </NavLink>
          </div>
        )}
        {!isRegional && (
          <NavLink
            to="/add-report"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <FilePlus size={16} strokeWidth={2} />
            <span>Add Report</span>
            {getNavCount('/add-report') > 0 && (
              <span className="sidebar-nav-badge">{getNavCount('/add-report')}</span>
            )}
          </NavLink>
        )}
        {navItemsAfterAddReport.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
            {getNavCount(to) > 0 && (
              <span className="sidebar-nav-badge">{getNavCount(to)}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-profile">
          <div className="user-avatar-small">
            <User size={16} />
          </div>
          <div className="user-info-text">
            <span className="user-greeting">Hello, {displayName}</span>
            <span className="user-type-label">
              {user?.account_type || user?.role || 'User'}
              {user?.city ? ` · ${user.city}` : user?.province ? ` · ${user.province}` : ''}
            </span>
          </div>
        </div>
        <button
          className="sidebar-link"
          onClick={() => setShowSettingsModal(true)}
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
        >
          <Settings size={16} strokeWidth={2} />
          <span>Settings</span>
        </button>
        <button className="sidebar-link logout-btn" onClick={openLogoutModal}>
          <LogOut size={16} strokeWidth={2} />
          <span>Logout</span>
        </button>
      </div>

      {showLogoutModal && createPortal(
        <div className="modal-overlay" onClick={closeLogoutModal} role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-confirm">
              <div className="modal-confirm-icon modal-confirm-icon--warning">
                <LogOut size={28} />
              </div>
              <h2 id="logout-modal-title" className="modal-confirm-title">Log out</h2>
              <p className="modal-confirm-text">Are you sure you want to log out?</p>
              <div className="modal-confirm-footer">
                <button type="button" className="modal-btn-cancel" onClick={closeLogoutModal}>
                  Cancel
                </button>
                <button type="button" className="modal-btn-danger" onClick={confirmLogout}>
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSettingsModal && createPortal(
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          user={user}
          onLogout={onLogout}
        />,
        document.body
      )}
    </aside>
  )
}
