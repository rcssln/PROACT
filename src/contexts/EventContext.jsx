import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Warning, CloudRain, Flame, Info, Check, Calendar, CaretRight, PlusCircle, Clock, X, CheckCircle } from '@phosphor-icons/react'
import api from '../lib/api'
import { io } from 'socket.io-client'
import HeaderFooterModal from '../components/HeaderFooterModal'
import ConfirmationModal from '../components/ConfirmationModal'
import Button from '../components/Button'
import '../styles/components/EventModal.css'
import '../styles/components/Toast.css'

const EventContext = createContext(null)

export function useEvents() {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEvents must be used within EventProvider')
  return ctx
}

export function EventProvider({ children, user }) {
  const navigate = useNavigate()
  
  // 1. Fundamental State
  const [events, setEvents] = useState([])
  const socketRef = useRef(null)
  const [currentEventId, setCurrentEventId] = useState(() => {
    return localStorage.getItem('selectedEventId') || null
  })
  const [selectedEventForReport, setSelectedEventForReport] = useState(null)
  const [situationalReports, setSituationalReports] = useState([])
  const [currentSituationalReport, setCurrentSituationalReport] = useState(null)
  const [showSelectEventModal, setShowSelectEventModal] = useState(false)
  const [targetPath, setTargetPath] = useState(null)
  const [onSelectCallback, setOnSelectCallback] = useState(null)
  const [userSignal, setUserSignal] = useState(null)
  const [loading, setLoading] = useState(true)
  const hasShownInitialToast = useRef(false)
  
  // 2. UI Utility State (Modals, Notifs)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
  const [eventDeployments, setEventDeployments] = useState([])
  const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    confirmText: 'Confirm', 
    cancelText: 'Cancel', 
    type: 'danger',
    isLoading: false,
    onCancel: null
  })
  const [toast, setToast] = useState({ show: false, title: '', message: '', type: 'info' })
  const [eventSignals, setEventSignals] = useState([])
  const [loadingSignals, setLoadingSignals] = useState(false)

  // 3. UI Utility Hooks (Must be defined before they are used in other hooks' dependencies)
  const showSuccess = useCallback((title, message) => {
    let finalTitle = title;
    let finalMessage = message;
    if (typeof title === 'object' && title !== null && !message) {
      finalTitle = title.title || 'Success';
      finalMessage = title.message || '';
    }
    setSuccessModal({
      show: true,
      title: String(finalTitle || 'Success'),
      message: String(finalMessage || '')
    })
  }, [])

  const closeSuccess = useCallback(() => {
    setSuccessModal(prev => ({ ...prev, show: false }))
  }, [])

  const showConfirm = useCallback((options) => {
    setConfirmModal({
      show: true,
      title: String(options.title || 'Are you sure?'),
      message: String(options.message || ''),
      onConfirm: options.onConfirm || null,
      confirmText: String(options.confirmText || 'Confirm'),
      cancelText: String(options.cancelText || 'Cancel'),
      type: options.type || 'danger',
      onCancel: options.onCancel || null
    })
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, show: false }))
  }, [])

  const showToast = useCallback((title, message, type = 'info') => {
    setToast({ show: true, title, message, type })
    // Auto close after 5 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 5000)
  }, [])

  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }))
  }, [])

  const handleConfirmAction = useCallback(async () => {
    console.log('[EventContext] handleConfirmAction triggered', { hasOnConfirm: !!confirmModal.onConfirm });
    if (!confirmModal.onConfirm) {
      closeConfirm()
      return
    }
    
    setConfirmModal(prev => ({ ...prev, isLoading: true }))
    try {
      console.log('[EventContext] Executing onConfirm callback...');
      await confirmModal.onConfirm()
      console.log('[EventContext] onConfirm callback finished successfully.');
      closeConfirm()
    } catch (err) {
      console.error('[EventContext] Confirm action failed:', err)
      setConfirmModal(prev => ({ ...prev, isLoading: false }))
    }
  }, [confirmModal, closeConfirm])

  const handleCancelAction = useCallback(() => {
    if (confirmModal.onCancel) {
      confirmModal.onCancel()
    }
    closeConfirm()
  }, [confirmModal, closeConfirm])

  // Helper: normalize raw DB event row to camelCase shape
  const mapEvent = (e) => ({
    id: e.id,
    name: e.name,
    color: e.color,
    startDate: e.start_date,
    endDate: e.end_date,
    eventType: e.event_type,
    alertStatus: e.alert_status,
    alertLevel: e.alert_level || '',
    approvalStatus: e.approval_status || 'Pending',
    approvedPdfUrl: e.approved_pdf_url || null,
    summary: e.summary || '',
    pingedReportTypes: e.pinged_report_types || [],
    affectedProvinces: e.affected_provinces || [],
    isDeployed: e.is_deployed || false,
    deployedAt: e.deployed_at || null,
    deployedSnapshot: e.deployed_snapshot || null
  })

  // 4. Data Fetching Hooks
  const fetchSituationalReports = useCallback(async (eventId) => {
    if (!eventId) return
    try {
      const { data } = await api.get('/situational-reports', { params: { event_id: eventId } })
      setSituationalReports(data || [])
      return data
    } catch (err) {
      console.error('Error fetching situational reports:', err)
      return []
    }
  }, [user])

  const fetchEventDeployments = useCallback(async (eventId) => {
    if (!eventId) return
    try {
      const { data } = await api.get('/deployments', { params: { event_id: eventId } })
      setEventDeployments(data || [])
      return data
    } catch (err) {
      console.error('Error fetching event deployments:', err)
      return []
    }
  }, [])

  const fetchUserSignal = useCallback(async (eventId) => {
    if (!user || !eventId) { setUserSignal(null); return }
    try {
      const { data } = await api.get('/signals/user', { params: { event_id: eventId } })
      setUserSignal(data?.signal || null)
    } catch (err) {
      console.error('Error fetching user signal:', err)
      setUserSignal(null)
    }
  }, [user])

  const fetchEvents = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await api.get('/events')
      const mappedEvents = (data || []).map(mapEvent)
      console.log('[EventContext] Fetched events:', mappedEvents.length)
      setEvents(mappedEvents)

      const activeEvent = mappedEvents.find(e => e.isDeployed)
      if (activeEvent && activeEvent.id !== currentEventId) {
        setCurrentEventId(activeEvent.id)
      }
      if (!currentEventId && mappedEvents.length > 0) {
        const firstDeployed = mappedEvents.find(e => e.isDeployed) || mappedEvents[0]
        if (firstDeployed) setCurrentEventId(firstDeployed.id)
      }
    } catch (err) {
      console.error('Error fetching events:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data || [])
      const unread = (data || []).filter(n => !n.is_read)
      setUnreadCount(unread.length)
      if (!hasShownInitialToast.current && unread.length > 0) {
        hasShownInitialToast.current = true
        showToast(
          'Unread Notifications',
          `You have ${unread.length} unread notification${unread.length > 1 ? 's' : ''} since your last visit.`,
          'info'
        )
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }, [user])

  const fetchPendingUsersCount = useCallback(async () => {
    if (!user) return
    const adminTypes = ['Regional Admin', 'Provincial Admin', 'LGU Admin', 'Super Admin']
    if (!adminTypes.includes(user.account_type) && user.role !== 'Super Admin') return
    try {
      const { data } = await api.get('/users/pending-count')
      setPendingUsersCount(data?.count || 0)
    } catch (err) {
      console.error('Error fetching pending users count:', err)
    }
  }, [user])

  const fetchPendingApprovalsCount = useCallback(async () => {
    if (!user) return
    const isLguApprover = user.account_type === 'LGU Approver'
    const isApprover = ['Provincial Approver', 'Super Admin', 'Regional Admin', 'Regional'].includes(user.account_type) || user.role === 'Super Admin'
    
    if (isLguApprover) {
      // LGU Approvers get count from the new lgu-submissions endpoint
      try {
        const { data } = await api.get('/lgu-submissions/pending-count')
        setPendingApprovalsCount(data?.count || 0)
      } catch (err) {
        console.error('Error fetching LGU pending approvals count:', err)
      }
      return
    }
    
    if (!isApprover) { setPendingApprovalsCount(0); return }
    try {
      const { data } = await api.get('/situational-reports', {
        params: { status: 'Pending Approval', count_only: true, event_id: 'all' }
      })
      setPendingApprovalsCount(Array.isArray(data) ? data.length : (data?.count || 0))
    } catch (err) {
      console.error('Error fetching pending approvals count:', err)
    }
  }, [user])

  const markNotificationAsRead = useCallback(async (notifId) => {
    try {
      await api.patch(`/notifications/${notifId}/read`)
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  const markSitRepNotificationsAsRead = useCallback(async (sitRepId) => {
    if (!user || !sitRepId) return
    try {
      const relevantNotifs = notifications.filter(n => {
        if (n.is_read) return false
        let d = n.data
        if (typeof d === 'string') try { d = JSON.parse(d) } catch (e) { d = {} }
        return String(d?.sitrep_id) === String(sitRepId)
      })
      if (relevantNotifs.length === 0) return
      const ids = relevantNotifs.map(n => n.id)
      await api.post('/notifications/mark-many-read', { ids })
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch (err) {
      console.error('Error marking SitRep notifications as read:', err)
    }
  }, [user, notifications])

  const markEventNotificationsAsRead = useCallback(async (eventId) => {
    if (!user || !eventId) return
    try {
      const relevantNotifs = notifications.filter(n => {
        if (n.is_read) return false
        let d = n.data
        if (typeof d === 'string') try { d = JSON.parse(d) } catch (e) { d = {} }
        return String(d?.event_id) === String(eventId)
      })
      if (relevantNotifs.length === 0) return
      const ids = relevantNotifs.map(n => n.id)
      await api.post('/notifications/mark-many-read', { ids })
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch (err) {
      console.error('Error marking event notifications as read:', err)
    }
  }, [user, notifications])

  const markUserNotificationsAsRead = useCallback(async (targetUserId) => {
    if (!user || !targetUserId) return
    try {
      const relevantNotifs = notifications.filter(n => {
        if (n.is_read) return false
        let d = n.data
        if (typeof d === 'string') try { d = JSON.parse(d) } catch (e) { d = {} }
        return String(d?.user_id) === String(targetUserId) || String(d?.target_user_id) === String(targetUserId)
      })
      if (relevantNotifs.length === 0) return
      const ids = relevantNotifs.map(n => n.id)
      await api.post('/notifications/mark-many-read', { ids })
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } catch (err) {
      console.error('Error marking user notifications as read:', err)
    }
  }, [user, notifications])

  // 4.5. Data Refresh Effect
  useEffect(() => {
    if (!user) return
    fetchEvents()
    fetchNotifications()
    fetchPendingUsersCount()
    fetchPendingApprovalsCount()
    if (currentEventId) fetchUserSignal(currentEventId)
  }, [user, fetchEvents, fetchNotifications, fetchPendingUsersCount, fetchPendingApprovalsCount, currentEventId, fetchUserSignal])

  // 5. Computed State
  const defaultEvent = {
    id: 'default-good-day',
    name: "It's a Good Day",
    eventType: 'Calm',
    alertStatus: 'white',
    color: '#10b981',
    pingedReportTypes: [],
    affectedProvinces: []
  }
  const currentEvent = events.find((e) => e.id === currentEventId) ?? events[0] ?? defaultEvent

  // 6. Effects

  // Real-time via Socket.io (replaces Supabase channels)
  useEffect(() => {
    if (!user) return

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    })
    socketRef.current = socket

    console.log('[Socket.io] Connecting for user:', user.id)

    // Events
    socket.on('events:created', (event) => {
      const mapped = mapEvent(event)
      setEvents(prev => {
        if (prev.some(e => e.id === mapped.id)) return prev
        return [mapped, ...prev]
      })
    })
    socket.on('events:updated', (event) => {
      const mapped = mapEvent(event)
      setEvents(prev => {
        // Use a map to ensure we don't have duplicates and preserve order
        const exists = prev.some(e => e.id === mapped.id)
        if (!exists) return [mapped, ...prev]

        if (mapped.isDeployed) {
          return prev.map(e => e.id === mapped.id ? mapped : { ...e, isDeployed: false })
        }
        return prev.map(e => e.id === mapped.id ? mapped : e)
      })
      if (mapped.isDeployed) setCurrentEventId(mapped.id)
    })
    socket.on('events:refresh_needed', () => {
      console.log('[Socket.io] Refresh needed, fetching events...')
      fetchEvents()
    })
    socket.on('events:deleted', ({ id }) => {
      setEvents(prev => prev.filter(e => e.id !== id))
    })

    // Situational Reports
    socket.on('sitrep:created', () => {
      if (currentEventId) fetchSituationalReports(currentEventId)
    })
    socket.on('sitrep:updated', () => {
      if (currentEventId) fetchSituationalReports(currentEventId)
      fetchPendingApprovalsCount()
    })

    // Notifications for this user
    socket.on(`notification:${user.id}`, (notif) => {
      setNotifications(prev => [notif, ...prev])
      setUnreadCount(prev => prev + 1)
      showToast(notif.title || 'New Notification', notif.message || '', 'info')
    })

    // Users changed (badge refresh)
    socket.on('users:changed', () => fetchPendingUsersCount())

    return () => {
      console.log('[Socket.io] Disconnecting')
      socket.disconnect()
      socketRef.current = null
    }
  }, [user, currentEventId, fetchSituationalReports, fetchPendingUsersCount, fetchPendingApprovalsCount, showToast])

  // Polling fallback for situational reports (30s) when socket misses an event
  useEffect(() => {
    if (!user || !currentEventId) return
    const interval = setInterval(() => {
      fetchSituationalReports(currentEventId)
    }, 30000)
    return () => clearInterval(interval)
  }, [user, currentEventId, fetchSituationalReports])

  useEffect(() => {
    if (events.length > 0 && !currentEventId) {
      const activeEvent = events.find(e => e.isDeployed)
      setCurrentEventId(activeEvent ? activeEvent.id : events[0].id)
    }
    if (currentEventId && events.length > 0 && !events.some((e) => e.id === currentEventId)) {
      const activeEvent = events.find(e => e.isDeployed)
      setCurrentEventId(activeEvent ? activeEvent.id : events[0].id)
    }
  }, [events, currentEventId])

  useEffect(() => {
    if (currentEventId && events.some(e => e.id === currentEventId)) {
      localStorage.setItem('selectedEventId', currentEventId)
    } else if (events.length === 0) {
      localStorage.removeItem('selectedEventId')
    }
  }, [currentEventId, events])

  // 7. Operations Hooks
  const sendSituationalReport = useCallback(async (reportId) => {
    if (!reportId) return false
    try {
      const { data } = await api.patch(`/situational-reports/${reportId}`, { status: 'Sent' })
      setSituationalReports(prev => prev.map(r => r.id === reportId ? data : r))
      if (currentSituationalReport?.id === reportId) {
        setCurrentSituationalReport(data)
      }
      
      await markSitRepNotificationsAsRead(reportId)
      return true
    } catch (err) {
      console.error('Error sending situational report:', err)
      return false
    }
  }, [currentSituationalReport])

  const createSituationalReport = useCallback(async (eventId, title, options = {}) => {
    if (!eventId) return null
    try {
      const payload = {
        event_id: eventId,
        title,
        target_lgus: options.targetLgus || [],
        pinged_report_types: options.pingedReportTypes || [],
        province: options.province || null,
      }
      if (options.copyFromId) {
        payload.copy_from_id = options.copyFromId
      }
      if (options.skip_auto_clone !== undefined) {
        payload.skip_auto_clone = options.skip_auto_clone
      }
      const { data } = await api.post('/situational-reports', payload)
      
      setSituationalReports(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('Error creating situational report:', err)
      throw err;
    }
  }, [])

  const updateSituationalReport = useCallback(async (reportId, updates) => {
    if (!reportId) return null
    try {
      const { data } = await api.patch(`/situational-reports/${reportId}`, {
        title: updates.title,
        target_lgus: updates.targetLgus,
        status: updates.status
      })
      
      setSituationalReports(prev => prev.map(r => r.id === reportId ? data : r))
      if (currentSituationalReport?.id === reportId) {
        setCurrentSituationalReport(data)
      }
      return data
    } catch (err) {
      console.error('Error updating situational report:', err)
      throw err
    }
  }, [currentSituationalReport])
  
  const notifyAffectedUsers = useCallback(async (eventId, eventName, provinces) => {
    if (!provinces || provinces.length === 0) return
    try {
      // Find all users in affected provinces
      const { data: usersToNotify } = await api.get('/users', {
        params: { province: provinces, account_type: ['Provincial', 'Provincial Admin', 'LGU', 'LGU Admin'], status: 'Active' }
      })

      if (usersToNotify && usersToNotify.length > 0) {
        const notifs = usersToNotify
          .filter(u => u.id !== user?.id)
          .map(u => ({
            user_id: u.id,
            type: 'event_update',
            title: 'Event Notification',
            message: `Event "${eventName}" is active in your area (${u.province}).`,
            data: { event_id: eventId }
          }))
        
        if (notifs.length > 0) {
          await api.post('/notifications/bulk', notifs)
        }
      }
    } catch (err) {
      console.error('Error notifying affected users:', err)
    }
  }, [user])

  const addEvent = useCallback(async (event) => {
    try {
      const capitalizedName = event.name 
        ? event.name.charAt(0).toUpperCase() + event.name.slice(1) 
        : 'Untitled Event'

      const payload = {
        name: capitalizedName,
        color: event.color || '#6366f1',
        start_date: event.startDate || null,
        end_date: event.endDate || null,
        event_type: event.eventType || 'calamity',
        alert_status: event.alertStatus || 'white',
        alert_level: event.alertLevel || null,
        pinged_report_types: event.pingedReportTypes || [],
        summary: event.summary || '',
        affected_provinces: event.affectedProvinces || []
      }
      
      const { data } = await api.post('/events', payload)
      const newEvent = mapEvent(data)
      // Removed manual setEvents call - handled by socket events:created
      showToast('Event Created', `Successfully created event: ${newEvent.name}`, 'success')

      return newEvent
    } catch (err) {
      console.error('Error adding event:', err)
      showToast('Error', 'Failed to add event: ' + err.message, 'danger')
      return null
    }
  }, [])

  const updateEvent = useCallback(async (id, updates) => {
    try {
      const payload = {}
      if (updates.name !== undefined) {
        payload.name = updates.name 
          ? updates.name.charAt(0).toUpperCase() + updates.name.slice(1) 
          : 'Untitled Event'
      }
      if (updates.color !== undefined) payload.color = updates.color
      if (updates.startDate !== undefined) payload.start_date = updates.startDate || null
      if (updates.endDate !== undefined) payload.end_date = updates.endDate || null
      if (updates.eventType !== undefined) payload.event_type = updates.eventType
      if (updates.alertStatus !== undefined) payload.alert_status = updates.alertStatus
      if (updates.alertLevel !== undefined) payload.alert_level = updates.alertLevel || null
      if (updates.pingedReportTypes !== undefined) payload.pinged_report_types = updates.pingedReportTypes
      if (updates.summary !== undefined) payload.summary = updates.summary
      if (updates.affectedProvinces !== undefined) payload.affected_provinces = updates.affectedProvinces
      if (updates.is_deployed !== undefined) payload.is_deployed = updates.is_deployed
      if (updates.deployedAt !== undefined) payload.deployed_at = updates.deployedAt || null
      if (updates.deployedSnapshot !== undefined) payload.deployed_snapshot = updates.deployedSnapshot || null

      const { data } = await api.patch(`/events/${id}`, payload)
      const updated = mapEvent(data)
      // Removed manual setEvents call - handled by socket events:updated
      showToast('Event Updated', `Successfully updated event details.`, 'success')
    } catch (err) {
      console.error('Error updating event:', err)
      showToast('Error', 'Failed to update event: ' + err.message, 'danger')
    }
  }, [])

  const fetchEventSignals = useCallback(async (eventId) => {
    if (!eventId) return []
    setLoadingSignals(true)
    try {
      const { data } = await api.get('/signals', { params: { event_id: eventId } })
      
      const deduplicated = (data || []).reduce((acc, current) => {
        const key = `${current.city?.toLowerCase() || ''}-${current.barangay?.toLowerCase() || ''}`;
        if (!acc[key]) {
          acc[key] = current;
        }
        return acc;
      }, {});
      
      setEventSignals(Object.values(deduplicated))
      return data || []
    } catch (err) {
      console.error('Error fetching event signals:', err)
      return []
    } finally {
      setLoadingSignals(false)
    }
  }, [])

  const assignSignal = useCallback(async (eventId, province, city, barangay, signal) => {
    if (!eventId || !user) return false
    try {
      let locationName = barangay || city || province
      
      if (signal === null) {
        await api.post('/signals/clear', { event_id: eventId, province, city, barangay })
        setEventSignals(prev => prev.filter(s => {
          const isMatch = s.event_id === eventId && 
            s.province?.toLowerCase() === province?.toLowerCase() &&
            (city ? s.city?.toLowerCase() === city?.toLowerCase() : !s.city) &&
            (barangay ? s.barangay?.toLowerCase() === barangay?.toLowerCase() : !s.barangay);
          return !isMatch;
        }))
        showToast('Signal Cleared', `Successfully cleared signal for ${locationName}`, 'success')
        return true
      }

      const { data } = await api.post('/signals/assign', {
        event_id: eventId,
        province,
        city: city || null,
        barangay: barangay || null,
        signal
      })

      if (data) {
        setEventSignals(prev => {
          const other = prev.filter(s => {
            const isMatch = s.event_id === eventId && 
              s.province?.toLowerCase() === province?.toLowerCase() &&
              (city ? s.city?.toLowerCase() === city?.toLowerCase() : !s.city) &&
              (barangay ? s.barangay?.toLowerCase() === barangay?.toLowerCase() : !s.barangay);
            return !isMatch;
          });
          return [...other, data];
        });
      }

      showToast('Signal Assigned', `Successfully assigned Signal ${signal} to ${locationName}`, 'success')
      return true
    } catch (err) {
      console.error('Error assigning signal:', err)
      showToast('Error', 'Failed to assign signal.', 'danger')
      return false
    }
  }, [user, showToast])

  const bulkAssignSignals = useCallback(async (eventId, province, locations, signal) => {
    if (!eventId || !user || !locations.length) return false
    try {
      if (signal === null) {
        for (const city of locations) {
          await api.post('/signals/clear', { event_id: eventId, province, city, barangay: null })
        }
        
        setEventSignals(prev => prev.filter(s => {
          if (s.event_id !== eventId || s.province?.toLowerCase() !== province?.toLowerCase() || s.barangay) return true;
          return !locations.some(loc => loc.toLowerCase() === s.city?.toLowerCase());
        }))

        showToast('Bulk Clear', `Successfully cleared signals for ${locations.length} locations.`, 'success')
        return true
      }

      const assignments = locations.map(city => ({
        event_id: eventId,
        province,
        city,
        barangay: null,
        signal
      }))

      const { data } = await api.post('/signals/bulk-assign', { assignments })
      
      if (data) {
        setEventSignals(prev => {
          const others = prev.filter(s => {
            if (s.event_id !== eventId || s.province?.toLowerCase() !== province?.toLowerCase() || s.barangay) return true;
            return !locations.some(loc => loc.toLowerCase() === s.city?.toLowerCase());
          });
          return [...others, ...data];
        });
      }

      showToast('Bulk Assigned', `Successfully assigned Signal ${signal} to ${locations.length} locations.`, 'success')
      return true
    } catch (err) {
      console.error('Error in bulkAssignSignals:', err)
      showToast('Error', 'Failed to assign signals in bulk.', 'danger')
      return false
    }
  }, [user, showToast])

  const deployEvent = useCallback(async (eventId) => {
    if (!user) return false
    try {
      const deployedAt = new Date().toISOString()
      const { data: dbEvent } = await api.get(`/events/${eventId}`)
      
      const snapshot = {
        name: dbEvent.name,
        eventType: dbEvent.event_type,
        alertStatus: dbEvent.alert_status,
        alertLevel: dbEvent.alert_level,
        summary: dbEvent.summary,
        affectedProvinces: dbEvent.affected_provinces,
        color: dbEvent.color,
        startDate: dbEvent.start_date,
        endDate: dbEvent.end_date,
        deployedAt: deployedAt
      }

      const { data } = await api.patch(`/events/${eventId}`, { 
        is_deployed: true, 
        deployed_at: deployedAt,
        deployed_snapshot: snapshot 
      })
      
      const updated = mapEvent(data)
      setEvents(prev => prev.map(e => e.id === eventId ? updated : { ...e, isDeployed: false }))
      setCurrentEventId(eventId)
      
      showSuccess('Success', `Event "${updated.name}" has been deployed successfully.`);
      return true
    } catch (err) {
      console.error('Error in deployEvent:', err)
      showSuccess('Error', `Failed to deploy event: ${err.message}`)
      return false
    }
  }, [user, showSuccess, setCurrentEventId])

  const deployToLgu = useCallback(async (deployData) => {
    if (!user) return false
    try {
      const { data } = await api.post('/deployments', {
        event_id: deployData.event_id,
        province: deployData.province,
        cities: deployData.cities,
        strength_label: deployData.strength_label,
        strength_value: deployData.strength_value
      })
      
      if (data) {
        setEventDeployments(prev => {
          const other = prev.filter(p => !deployData.cities.includes(p.city) || p.event_id !== deployData.event_id)
          return [...other, ...data]
        })
      }

      showSuccess('Success', 'Event deployed to LGUs successfully.');
      return true
    } catch (err) {
      console.error('Error deploying to LGU:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error'
      showSuccess('Error', `Failed to deploy to LGUs: ${errorMsg}`)
      return false
    }
  }, [user, showSuccess])

  const deleteEvent = useCallback(async (id) => {
    try {
      await api.delete(`/events/${id}`)
      // Removed manual setEvents call - handled by socket events:deleted
      if (currentEventId === id) setCurrentEventId(null)
      showToast('Event Deleted', 'The event and all its associated data have been removed.', 'success')
    } catch (err) {
      console.error('Error deleting event:', err)
      showToast('Error', 'Failed to delete event: ' + (err.response?.data?.error || err.message), 'danger')
    }
  }, [currentEventId, showToast])

  const openSelectEventModal = useCallback((path, callback) => {
    const safePath = (typeof path === 'string') ? path : null
    setTargetPath(safePath)
    setOnSelectCallback(() => callback || null)
    setShowSelectEventModal(true)
  }, [])

  const closeSelectEventModal = useCallback(() => {
    setShowSelectEventModal(false)
    setTargetPath(null)
    setOnSelectCallback(null)
  }, [])

  const confirmSelectEvent = useCallback((event) => {
    setSelectedEventForReport(event)
    closeSelectEventModal()
    if (onSelectCallback) onSelectCallback(event)
    if (user && event) {
      api.post('/activity-logs', { action: 'Selected event for report', details: `Event: ${event.name}` })
        .catch(err => console.error('Error logging event selection:', err))
    }
    if (targetPath) navigate(targetPath)
  }, [targetPath, onSelectCallback, closeSelectEventModal, navigate, user])

  const switchEvent = useCallback((eventId) => {
    const event = events.find(e => e.id === eventId)
    if (user && event) {
      api.post('/activity-logs', { action: 'Switched dashboard event', details: `Event: ${event.name}` })
        .catch(err => console.error('Error logging event switch:', err))
    }
    setCurrentEventId(eventId)
  }, [events, user])

  const value = {
    events,
    currentEvent,
    currentEventId,
    setCurrentEventId,
    selectedEventForReport,
    situationalReports,
    currentSituationalReport,
    setCurrentSituationalReport,
    fetchSituationalReports,
    sendSituationalReport,
    pendingApprovalsCount,
    fetchPendingApprovalsCount,
    createSituationalReport,
    updateSituationalReport,
    deployEvent,
    deployToLgu,
    addEvent,
    updateEvent,
    deleteEvent,
    openSelectEventModal,
    closeSelectEventModal,
    confirmSelectEvent,
    switchEvent,
    loading,
    showSuccess,
    showConfirm,
    eventDeployments,
    fetchEventDeployments,
    notifications,
    unreadCount,
    markNotificationAsRead,
    markSitRepNotificationsAsRead,
    markEventNotificationsAsRead,
    markUserNotificationsAsRead,
    fetchEvents,
    fetchNotifications,
    pendingUsersCount,
    fetchPendingUsersCount,
    fetchEventSignals,
    assignSignal,
    bulkAssignSignals,
    eventSignals,
    loadingSignals,
    userSignal,
    socket: socketRef.current,
    toast,
    showToast,
    closeToast
  }

  return (
    <EventContext.Provider value={value}>
      {children}
      {showSelectEventModal && createPortal(<SelectEventModal events={events} onClose={closeSelectEventModal} onSelect={confirmSelectEvent} />, document.body)}
      <ConfirmationModal
        isOpen={successModal.show}
        onClose={closeSuccess}
        title={successModal.title || 'Success'}
        message={successModal.message}
        type="success"
        confirmText="Close"
        onConfirm={closeSuccess}
      />

      <ConfirmationModal
        isOpen={confirmModal.show}
        onClose={handleCancelAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={handleConfirmAction}
        type={confirmModal.type === 'danger' ? 'danger' : 'primary'}
        isLoading={confirmModal.isLoading}
      />
      {toast.show && createPortal(
        <div className="notification-toast-container">
          <div className={`notification-toast ${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' ? <Check size={20} /> : <Info size={20} />}
            </div>
            <div className="toast-content">
              <h4 className="toast-title">{toast.title}</h4>
              <p className="toast-message">{toast.message}</p>
            </div>
            <button className="toast-close" onClick={closeToast}>
              <X size={16} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </EventContext.Provider>
  )
}

function SelectEventModal({ events, onClose, onSelect }) {
  const [selectedId, setSelectedId] = useState('')
  const selected = events.find((e) => e.id === selectedId)
  
  return (
    <HeaderFooterModal
      isOpen={true}
      onClose={onClose}
      title="Select Event"
      subtitle="Choose an active event for this report."
      maxWidth="440px"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          {events.length > 0 && (
            <Button 
              variant="solid" 
              onClick={() => selected && onSelect(selected)} 
              disabled={!selectedId}
              rightIcon={<CaretRight size={16} />}
            >
              Continue
            </Button>
          )}
        </>
      }
    >
      {events.length === 0 ? (
        <div className="event-modal-empty">
          <PlusCircle className="event-modal-empty-icon" size={32} />
          <p style={{ fontSize: '0.8125rem' }}>No active events found.</p>
          <Button variant="solid" onClick={onClose} style={{ marginTop: '1rem' }}>Go to Dashboard</Button>
        </div>
      ) : (
        <div className="event-selection-list">
          {events.map((ev) => (
            <div key={ev.id} className={`event-selection-card ${selectedId === ev.id ? 'active' : ''}`} onClick={() => setSelectedId(ev.id)}>
              <div className="event-selection-avatar">{ev.name.charAt(0).toUpperCase()}</div>
              <div className="event-selection-info">
                <span className="event-selection-name">{ev.name}</span>
                <div className="event-selection-meta"><Calendar size={12} /><span>{ev.startDate ? new Date(ev.startDate).toLocaleDateString() : 'No date'}</span></div>
              </div>
              <div className="event-selection-radio"><div className="event-selection-radio-inner" /></div>
            </div>
          ))}
        </div>
      )}
    </HeaderFooterModal>
  )
}
