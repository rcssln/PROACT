import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  SquaresFour, FilePlus, Users, Gear, SignOut, FileText, ChartBar, User, CalendarCheck, CheckSquareOffset, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useEvents } from '../contexts/EventContext'
import SettingsModal from './SettingsModal'
import ConfirmationModal from './ConfirmationModal'
import '../styles/components/Sidebar.css'

export default function Sidebar({ user, onLogout, onUserUpdate, isCollapsed, onToggle }) {
  const accountType = user?.account_type || ''
  const isRegional = accountType === 'Regional' || accountType === 'Regional Admin'
  const isProvincial = accountType === 'Provincial' || accountType === 'Provincial Admin'
  const isRegionalAdmin = accountType === 'Regional Admin'
  const isProvincialAdmin = accountType === 'Provincial Admin'
  const isLguAdmin = accountType === 'LGU Admin'
  const isSuperAdmin = user?.role === 'Super Admin' || accountType === 'Super Admin'
  // Any admin type (can see Users sidebar)
  const isAdmin = isRegionalAdmin || isProvincialAdmin || isLguAdmin || isSuperAdmin
  const navigate = useNavigate()
  const location = useLocation()
  const { currentEvent, notifications, pendingUsersCount, pendingApprovalsCount } = useEvents()
  
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
      case '/for-approval':
        return pendingApprovalsCount || 0
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

  // Users link is now handled conditionally (admin-only) below



  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-branding">
          <img src="/asset1-logo.svg" alt="SIREN Logo" className="sidebar-logo-image" />
        </div>
        <button 
          className="sidebar-toggle-btn" 
          onClick={onToggle}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <CaretRight size={14} weight="bold" /> : <CaretLeft size={14} weight="bold" />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          title={isCollapsed ? 'Dashboard' : ''}
        >
          <SquaresFour size={16} weight="bold" />
          {!isCollapsed && <span>Dashboard</span>}
          {getNavCount('/dashboard') > 0 && (
            <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
              {getNavCount('/dashboard')}
            </span>
          )}
        </NavLink>
        {(isAdmin || isRegional || isProvincial) && (
          <NavLink
            to="/manage-events"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Manage Events' : ''}
          >
            <CalendarCheck size={16} weight="bold" />
            {!isCollapsed && <span>Manage Events</span>}
            {getNavCount('/manage-events') > 0 && (
              <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
                {getNavCount('/manage-events')}
              </span>
            )}
          </NavLink>
        )}
        {(isProvincial || isRegional || accountType === 'Provincial Approver' || isSuperAdmin) && (
          <div className="sidebar-nav-group">
            <NavLink
              to="/consolidated-report"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={isCollapsed ? 'Consolidated Report' : ''}
            >
              <ChartBar size={16} weight="bold" />
              {!isCollapsed && <span>Consolidated Report</span>}
              {getNavCount('/consolidated-report') > 0 && (
                <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
                  {getNavCount('/consolidated-report')}
                </span>
              )}
            </NavLink>
          </div>
        )}
        {!isRegional && accountType !== 'Provincial Approver' && (
          <NavLink
            to="/add-report"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Add Report' : ''}
          >
            <FilePlus size={16} weight="bold" />
            {!isCollapsed && <span>Add Report</span>}
            {getNavCount('/add-report') > 0 && (
              <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
                {getNavCount('/add-report')}
              </span>
            )}
          </NavLink>
        )}
        {(accountType === 'Provincial Approver' || isSuperAdmin || isRegional) && (
          <NavLink
            to="/for-approval"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'For Approval' : ''}
          >
            <CheckSquareOffset size={16} weight="bold" />
            {!isCollapsed && <span>For Approval</span>}
            {getNavCount('/for-approval') > 0 && (
              <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
                {getNavCount('/for-approval')}
              </span>
            )}
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/users"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Users' : ''}
          >
            <Users size={16} weight="bold" />
            {!isCollapsed && <span>Users</span>}
            {getNavCount('/users') > 0 && (
              <span className={isCollapsed ? 'sidebar-nav-badge--collapsed' : 'sidebar-nav-badge'}>
                {getNavCount('/users')}
              </span>
            )}
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-profile">
          <div className="user-avatar-small" title={isCollapsed ? displayName : ''}>
            <User size={16} />
          </div>
          {!isCollapsed && (
            <div className="user-info-text">
              <span className="user-greeting">Hello, {displayName}</span>
              <span className="user-type-label">
                {user?.account_type || user?.role || 'User'}
                {user?.account_type?.startsWith('Provincial')
                  ? (user?.province ? ` · ${user.province}` : '') 
                  : (user?.city ? ` · ${user.city}` : user?.province ? ` · ${user.province}` : '')}
              </span>
            </div>
          )}
        </div>
        <button
          className="sidebar-link"
          onClick={() => setShowSettingsModal(true)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
          title={isCollapsed ? 'Settings' : ''}
        >
          <Gear size={16} weight="bold" />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button 
          className="sidebar-link logout-btn" 
          onClick={openLogoutModal}
          title={isCollapsed ? 'Logout' : ''}
        >
          <SignOut size={16} weight="bold" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={closeLogoutModal}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        type="danger"
        icon={SignOut}
        onConfirm={confirmLogout}
        maxWidth="380px"
      />

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          user={user}
          onLogout={onLogout}
          onUserUpdate={onUserUpdate}
        />
      )}
    </aside>
  )
}
