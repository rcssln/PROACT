import { useState, useRef, useEffect } from 'react'
import { Bell, X, Calendar, Send, Info, CheckCircle2 } from 'lucide-react'
import { useEvents } from '../contexts/EventContext'
import '../styles/components/NotificationBell.css'

export default function NotificationBell({ onNotificationClick }) {
  const { notifications, unreadCount, markNotificationAsRead } = useEvents()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const [isRinging, setIsRinging] = useState(false)
  const prevCountRef = useRef(unreadCount)

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsRinging(true)
      const timer = setTimeout(() => setIsRinging(false), 500)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = unreadCount
  }, [unreadCount])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleItemClick = (notif) => {
    markNotificationAsRead(notif.id)
    onNotificationClick?.(notif)
    setIsOpen(false)
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className={`bell-button ${unreadCount > 0 ? 'has-unread' : ''} ${isRinging ? 'ring-animation' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown glass-card">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && <span className="notification-count">{unreadCount} unread</span>}
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleItemClick(notif)}
                >
                  <div className="notification-icon-wrap">
                    {notif.type === 'event_deployment' ? <Send size={16} /> : <Info size={16} />}
                  </div>
                  <div className="notification-content">
                    <p className="notification-title">{notif.title}</p>
                    <p className="notification-message">{notif.message}</p>
                    <span className="notification-time">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!notif.is_read && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
