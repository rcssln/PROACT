import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CloudRain,
  Activity,
  Flame,
  Info,
  Check,
  Calendar,
  ChevronRight,
  PlusCircle,
  Clock,
  X,
  CheckCircle2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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
  const [currentEventId, setCurrentEventId] = useState(() => {
    return localStorage.getItem('selectedEventId') || null
  })
  const [selectedEventForReport, setSelectedEventForReport] = useState(null)
  const [situationalReports, setSituationalReports] = useState([])
  const [currentSituationalReport, setCurrentSituationalReport] = useState(null)
  const [showSelectEventModal, setShowSelectEventModal] = useState(false)
  const [targetPath, setTargetPath] = useState(null)
  const [onSelectCallback, setOnSelectCallback] = useState(null)
  const [loading, setLoading] = useState(true)
  const hasShownInitialToast = useRef(false)
  
  // 2. UI Utility State (Modals, Notifs)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [eventDeployments, setEventDeployments] = useState([])
  const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '' })
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', cancelText: 'Cancel', type: 'danger' })
  const [toast, setToast] = useState({ show: false, title: '', message: '', type: 'info' })

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
      type: options.type || 'danger'
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

  const handleConfirmAction = useCallback(() => {
    if (confirmModal.onConfirm) confirmModal.onConfirm()
    closeConfirm()
  }, [confirmModal, closeConfirm])

  // 4. Data Fetching Hooks
  const fetchSituationalReports = useCallback(async (eventId) => {
    if (!supabase || !eventId) return
    try {
      let query = supabase.from('situational_reports').select('*').eq('event_id', eventId).order('report_number', { ascending: false })
      const { data, error } = await query
      if (error) throw error
      setSituationalReports(data || [])
      return data
    } catch (err) {
      console.error('Error fetching situational reports:', err)
      return []
    }
  }, [])

  const fetchEventDeployments = useCallback(async (eventId) => {
    if (!supabase || !eventId) return
    try {
      const { data, error } = await supabase
        .from('event_deployments')
        .select('*')
        .eq('event_id', eventId)
      if (error) throw error
      setEventDeployments(data || [])
      return data
    } catch (err) {
      console.error('Error fetching event deployments:', err)
      return []
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    if (!supabase) return
    try {
      let query = supabase.from('events').select('*')
      
      if (user && user.account_type === 'LGU') {
        const { data: deployments } = await supabase
          .from('event_deployments')
          .select('event_id')
          .eq('city', user.city)
        
        const deployedEventIds = (deployments || []).map(d => d.event_id)
        if (deployedEventIds.length === 0) {
          setEvents([])
          setLoading(false)
          return
        }
        query = query.in('id', deployedEventIds)
      }
      // All other user types see all events (no is_deployed filter)

      const { data, error } = await query.order('start_date', { ascending: false })
      if (error) throw error

      const mappedEvents = (data || []).map(e => ({
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
      }));
      console.log('Fetched Events from Supabase:', mappedEvents);
      setEvents(mappedEvents)

      // If we have a currentEventId, check if it still exists or if a new one is deployed
      const activeEvent = mappedEvents.find(e => e.isDeployed)
      if (activeEvent && activeEvent.id !== currentEventId) {
        console.log('New active event detected, switching to:', activeEvent.name)
        setCurrentEventId(activeEvent.id)
      }

      // Auto-initialize active event for Regional/Super Admin users if none selected
      if (!currentEventId && mappedEvents.length > 0) {
        const firstDeployed = mappedEvents.find(e => e.isDeployed) || mappedEvents[0]
        if (firstDeployed) {
          console.log('Auto-initializing active event to:', firstDeployed.name)
          setCurrentEventId(firstDeployed.id)
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchNotifications = useCallback(async () => {
    if (!supabase || !user) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotifications(data || [])
      const unread = data?.filter(n => !n.is_read) || []
      setUnreadCount(unread.length)

      // Show summary toast on initial load if there are unread notifications
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
    if (!supabase || !user) return
    // Only fetch if admin/super admin/regional/provincial
    const canManageUsers = user.account_type === 'Regional' || user.account_type === 'Provincial' || user.account_type === 'Super Admin' || user.role === 'Super Admin'
    if (!canManageUsers) return

    try {
      let query = supabase.from('users').select('id', { count: 'exact', head: true })
      
      // Filtering based on permissions
      if (user.account_type === 'Provincial') {
        query = query.eq('province', user.province)
      }

      // Count those who are Pending OR must change password
      const { count, error } = await query.or('status.eq.Pending,must_change_password.eq.true')
      
      if (error) throw error
      setPendingUsersCount(count || 0)
    } catch (err) {
      console.error('Error fetching pending users count:', err)
    }
  }, [user])

  const markNotificationAsRead = useCallback(async (notifId) => {
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)
      if (error) throw error
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  const markSitRepNotificationsAsRead = useCallback(async (sitRepId) => {
    if (!supabase || !user || !sitRepId) return
    try {
      // Find unread notifications for this user related to this SitRep
      const relevantNotifs = notifications.filter(n => {
        if (n.is_read) return false
        let data = n.data
        if (typeof data === 'string') try { data = JSON.parse(data) } catch (e) { data = {} }
        return String(data?.sitrep_id) === String(sitRepId)
      })

      if (relevantNotifs.length === 0) return

      const notifIds = relevantNotifs.map(n => n.id)
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notifIds)
      
      if (error) throw error

      setNotifications(prev => prev.map(n => notifIds.includes(n.id) ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - notifIds.length))
      console.log(`Auto-marked ${notifIds.length} notifications as read for SitRep: ${sitRepId}`)
    } catch (err) {
      console.error('Error auto-marking SitRep notifications as read:', err)
    }
  }, [user, notifications])

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
  useEffect(() => {
    // Initial data fetch
    fetchEvents()
    fetchNotifications()
    fetchPendingUsersCount()
  }, [fetchEvents, fetchNotifications, fetchPendingUsersCount])

  // Stable Subscriptions (User-based)
  useEffect(() => {
    if (!supabase || !user) return

    console.log(`Setting up stable real-time subscriptions for user: ${user.id}`)

    // 1. Notifications Subscription
    const notificationsChannel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload.new?.title)
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)
          showToast(payload.new.title || 'New Notification', payload.new.message || '', 'info')
        }
      )
      .subscribe()

    const eventsChannel = supabase
      .channel('public-events-changes-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Event table change:', payload.eventType, payload.new?.name || payload.old?.id)
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedEvent = {
              id: payload.new.id,
              name: payload.new.name,
              color: payload.new.color,
              startDate: payload.new.start_date,
              endDate: payload.new.end_date,
              eventType: payload.new.event_type,
              alertStatus: payload.new.alert_status,
              alertLevel: payload.new.alert_level || '',
              approvalStatus: payload.new.approval_status || 'Pending',
              approvedPdfUrl: payload.new.approved_pdf_url || null,
              summary: payload.new.summary || '',
              pingedReportTypes: payload.new.pinged_report_types || [],
              affectedProvinces: payload.new.affected_provinces || [],
              isDeployed: payload.new.is_deployed || false,
              deployedAt: payload.new.deployed_at || null,
              deployedSnapshot: payload.new.deployed_snapshot || null
            }

            setEvents(prev => {
              const exists = prev.some(e => e.id === updatedEvent.id)
              if (exists) {
                return prev.map(e => e.id === updatedEvent.id ? updatedEvent : e)
              }
              return [updatedEvent, ...prev]
            })

            // Auto-switch if it's the newly deployed event
            if (updatedEvent.isDeployed) {
              console.log('Real-time switch to newly deployed event:', updatedEvent.name)
              setCurrentEventId(updatedEvent.id)
            }
          } else if (payload.eventType === 'DELETE') {
            setEvents(prev => prev.filter(e => e.id !== payload.old.id))
          }
          
          // Still fetch all to stay perfectly in sync in case of misses
          fetchEvents()
        }
      )
      .subscribe()

    // 3. Event Deployments Subscription
    const deploymentsChannel = supabase
      .channel('public-deployments-changes-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_deployments' },
        (payload) => {
          if (user.account_type === 'LGU') {
            const affectedCity = payload.new?.city || payload.old?.city
            if (affectedCity === user.city) {
              console.log('Deployment change for this LGU detected')
              fetchEvents()
            }
          } else {
            fetchEvents()
          }
        }
      )
      .subscribe()

    // 4. Users Subscription (Real-time badge updates)
    const usersChannel = supabase
      .channel('public-users-changes-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          console.log('User table change detected, refreshing pending count')
          fetchPendingUsersCount()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up stable subscriptions')
      supabase.removeChannel(notificationsChannel)
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(deploymentsChannel)
      supabase.removeChannel(usersChannel)
    }
  }, [user, fetchEvents, fetchPendingUsersCount, showToast])

  // Event-specific Subscriptions
  useEffect(() => {
    if (!supabase || !user || !currentEventId) return

    console.log(`Setting up event-specific subscriptions for: ${currentEventId}`)

    const sitRepsChannel = supabase
      .channel(`situational-reports-${currentEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'situational_reports',
          filter: `event_id=eq.${currentEventId}`
        },
        (payload) => {
          console.log('Situational report change for current event detected')
          fetchSituationalReports(currentEventId)
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up event-specific subscriptions')
      supabase.removeChannel(sitRepsChannel)
    }
  }, [user, currentEventId, fetchSituationalReports])

  useEffect(() => {
    if (events.length > 0 && !currentEventId) {
      setCurrentEventId(events[0].id)
    }
    if (currentEventId && events.length > 0 && !events.some((e) => e.id === currentEventId)) {
      setCurrentEventId(events[0].id)
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
    if (!supabase || !reportId) return false
    try {
      const { data, error } = await supabase.from('situational_reports').update({ status: 'Sent' }).eq('id', reportId).select().single()
      if (error) throw error
      setSituationalReports(prev => prev.map(r => r.id === reportId ? data : r))
      if (currentSituationalReport?.id === reportId) {
        setCurrentSituationalReport(data)
      }
      
      // Auto-mark notifications for this SitRep as read
      await markSitRepNotificationsAsRead(reportId)

      return true
    } catch (err) {
      console.error('Error sending situational report:', err)
      return false
    }
  }, [currentSituationalReport])

  const createSituationalReport = useCallback(async (eventId, title, options = {}) => {
    if (!supabase || !eventId) return null
    try {
      const { data: existing } = await supabase.from('situational_reports').select('report_number').eq('event_id', eventId).order('report_number', { ascending: false }).limit(1)
      const nextNumber = (existing?.[0]?.report_number || 0) + 1
      const finalTitle = title || `Situational Report No. ${nextNumber}`
      const { data, error } = await supabase.from('situational_reports').insert({ 
        event_id: eventId, 
        report_number: nextNumber, 
        title: finalTitle, 
        target_lgus: options.targetLgus || [],
        province: user?.province || null,
        created_by: user?.id || null
      }).select().single()
      if (error) throw error
      if (options.pingedReportTypes && options.pingedReportTypes.length > 0) {
        const { error: eventError } = await supabase.from('events').update({ pinged_report_types: options.pingedReportTypes }).eq('id', eventId)
        if (!eventError) {
          setEvents(prev => prev.map(e => e.id === eventId ? { ...e, pingedReportTypes: options.pingedReportTypes } : e))
        }
      }

      // Send notifications to targeted LGUs
      try {
        console.log('Sending LGU notifications for targeted LGUs:', options.targetLgus);
        let cityQuery = supabase.from('users').select('id, city, province').eq('account_type', 'LGU')
        
        if (options.targetLgus && options.targetLgus.length > 0) {
          // Normalize city names: "City (Province)" -> "City"
          const normalizedCities = options.targetLgus.map(city => city.includes(' (') ? city.split(' (')[0] : city)
          cityQuery = cityQuery.in('city', normalizedCities)
          if (user?.province) {
            cityQuery = cityQuery.eq('province', user.province)
          }
        } else if (user?.province) {
          // Default to all LGUs in the user's province if no specific LGUs selected
          cityQuery = cityQuery.eq('province', user.province)
        } else {
          cityQuery = null
        }

        if (cityQuery) {
          const { data: lguUsers, error: lguError } = await cityQuery
          if (lguError) throw lguError;
          
          if (lguUsers?.length > 0) {
            console.log(`Found ${lguUsers.length} LGU users to notify`);
            
            // Ensure these LGUs are deployed to the event so they can see it in Add Report
            const deploymentsToInsert = lguUsers.map(u => ({
              event_id: eventId,
              city: u.city,
              province: u.province || user?.province,
              deployed_by: user?.id,
              strength_label: 'Standard',
              strength_value: 1
            }))
            
            const { error: deployError } = await supabase
              .from('event_deployments')
              .upsert(deploymentsToInsert, { onConflict: 'event_id, city' })
            
            if (deployError) console.error('Error auto-deploying LGUs:', deployError);
            else console.log('Successfully auto-deployed LGUs to event');

            const notificationsToInsert = lguUsers.map(u => ({
              user_id: u.id,
              type: 'sitrep_assignment',
              title: 'New Situational Report',
              message: `A new situational report "${finalTitle}" has been created for your LGU.`,
              data: { sitrep_id: data.id, event_id: eventId, created_at: new Date().toISOString() }
            }))
            const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert)
            if (insertError) console.error('Error inserting notifications:', insertError);
            else console.log('Successfully inserted LGU notifications');
          } else {
            console.log('No LGU users found for the given targets/province');
          }
        }
      } catch (notifErr) {
        console.error('Failed to send LGU notifications:', notifErr)
      }

      setSituationalReports(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('Error creating situational report:', err)
      throw err;
    }
  }, [user])

  const updateSituationalReport = useCallback(async (reportId, updates) => {
    if (!supabase || !reportId) return null
    try {
      const { data, error } = await supabase
        .from('situational_reports')
        .update({
          title: updates.title,
          target_lgus: updates.targetLgus,
          status: updates.status
        })
        .eq('id', reportId)
        .select()
        .single()
      if (error) throw error
      
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

  const addEvent = useCallback(async (event) => {
    if (!supabase) return null
    try {
      const payload = {
        name: event.name || 'Untitled Event',
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
      
      if (payload.start_date === '') payload.start_date = null
      if (payload.end_date === '') payload.end_date = null
      const { data, error } = await supabase.from('events').insert(payload).select().single()
      if (error) throw error
      if (user) {
        await supabase.from('activity_logs').insert({ user_id: user.id, action: 'Created new event', details: `Event: ${data.name}` })
      }
      const newEvent = {
        id: data.id,
        name: data.name,
        color: data.color,
        startDate: data.start_date,
        endDate: data.end_date,
        eventType: data.event_type,
        alertStatus: data.alert_status,
        alertLevel: data.alert_level || '',
        approvalStatus: data.approval_status || 'Pending',
        approvedPdfUrl: data.approved_pdf_url || null,
        summary: data.summary || '',
        pingedReportTypes: data.pinged_report_types || [],
        affectedProvinces: data.affected_provinces || [],
        deployedSnapshot: data.deployed_snapshot || null
      }
      setEvents((prev) => [newEvent, ...prev])
      return newEvent
    } catch (err) {
      console.error('Error adding event:', err)
      alert('Failed to add event: ' + err.message)
      return null
    }
  }, [user])

  const updateEvent = useCallback(async (id, updates) => {
    if (!supabase) return
    try {
      const payload = {}
      if (updates.name !== undefined) payload.name = updates.name
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

      if (payload.start_date === '') payload.start_date = null
      if (payload.end_date === '') payload.end_date = null
      if (payload.deployed_at === '') payload.deployed_at = null
      if (payload.deployed_snapshot === '') payload.deployed_snapshot = null

      const { error } = await supabase.from('events').update(payload).eq('id', id)
      if (error) throw error
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)))
    } catch (err) {
      console.error('Error updating event:', err)
      alert('Failed to update event: ' + err.message)
    }
  }, [])

  const deployEvent = useCallback(async (eventId) => {
    if (!supabase || !user) return false
    try {
      console.log('Attempting to deploy event:', eventId)
      
      // Fetch the latest data from DB to ensure snapshot is accurate
      const { data: dbEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      
      if (fetchError || !dbEvent) {
        console.error('Error fetching latest event for deployment:', fetchError)
        return false
      }

      const deployedAt = new Date().toISOString()
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

      // 1. Un-deploy all other events (Single deployment rule)
      const { error: unDeployError } = await supabase
        .from('events')
        .update({ is_deployed: false })
        .neq('id', eventId)
      
      if (unDeployError) {
        console.error('Error un-deploying other events:', unDeployError)
        throw unDeployError
      }

      // 2. Deploy target event and save snapshot
      const { error } = await supabase
        .from('events')
        .update({ 
          is_deployed: true, 
          deployed_at: deployedAt,
          deployed_snapshot: snapshot 
        })
        .eq('id', eventId)
      
      if (error) {
        console.error('Supabase error updating is_deployed:', error)
        throw error
      }

      // 3. Update local state
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) {
          return { 
            ...e, 
            isDeployed: true, 
            deployedAt, 
            deployedSnapshot: snapshot,
            // Also update with the latest DB data in case local state was stale
            name: dbEvent.name,
            eventType: dbEvent.event_type,
            alertStatus: dbEvent.alert_status,
            alertLevel: dbEvent.alert_level || '',
            summary: dbEvent.summary || '',
            affectedProvinces: dbEvent.affected_provinces || [],
            color: dbEvent.color,
            startDate: dbEvent.start_date,
            endDate: dbEvent.end_date
          }
        }
        return { ...e, isDeployed: false }
      }))
      
      // Auto-switch to the newly deployed event so it shows on the dashboard
      setCurrentEventId(eventId)

      console.log('Event marked as deployed in DB. Checking provinces for notifications:', dbEvent.affected_provinces)
      // ... (notification logic remains the same)
      if (dbEvent.affected_provinces && dbEvent.affected_provinces.length > 0) {
        const cleanAffectedProvinces = dbEvent.affected_provinces.map(p => p.trim().toLowerCase())
        const { data: allUsers, error: userError } = await supabase.from('users').select('id, province, account_type')
        if (userError) throw userError
        
        const affectedUsers = allUsers?.filter(u => {
          const isProvincial = (u.account_type || '').trim().toLowerCase() === 'provincial'
          if (!isProvincial || !u.province) return false
          const userProv = u.province.trim().toLowerCase()
          return cleanAffectedProvinces.includes(userProv)
        }) || []

        if (affectedUsers.length > 0) {
          const notifPayload = affectedUsers.map(u => ({
            user_id: u.id,
            type: 'event_deployment',
            title: 'New Event Deployment',
            message: `Event "${dbEvent.name}" has been deployed to your province.`,
            data: { event_id: eventId }
          }))
          await supabase.from('notifications').insert(notifPayload)
        }
      }
      
      showSuccess('Success', `Event "${dbEvent.name}" has been deployed successfully.`);
      return true
    } catch (err) {
      console.error('Error in deployEvent:', err)
      alert(`Failed to deploy event: ${err.message}`)
      return false
    }
  }, [events, user, showSuccess, setCurrentEventId])

  const deployToLgu = useCallback(async (deployData) => {
    if (!supabase || !user) return false
    try {
      const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      
      // Real-time check: Verify if the current user exists in the database to avoid FK violations
      let actualUserId = null
      if (user?.id && isValidUUID(user.id)) {
        const { data: dbUser } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
        if (dbUser) actualUserId = dbUser.id
      }

      const deployments = deployData.cities.map(city => ({
        event_id: deployData.event_id,
        province: deployData.province,
        city: city,
        strength_label: deployData.strength_label,
        strength_value: deployData.strength_value,
        // MUST set to null explicitly if invalid to overwrite any corrupted/stale values in DB
        deployed_by: actualUserId || null
      }))

      console.log('Deploying to LGUs (Payload):', JSON.stringify(deployments, null, 2))
      
      const { data, error } = await supabase
        .from('event_deployments')
        .upsert(deployments, { onConflict: 'event_id, city' })
        .select()
      
      if (error) throw error
      
      if (data) {
        setEventDeployments(prev => {
          const other = prev.filter(p => !deployData.cities.includes(p.city) || p.event_id !== deployData.event_id)
          return [...other, ...data]
        })

        // ══════════════ NEW: NOTIFY LGU USERS ══════════════
        console.log('Deployment to LGUs successful. Sending notifications to LGU users...')
        try {
          const { data: lguUsers, error: userError } = await supabase
            .from('users')
            .select('id, city')
            .eq('account_type', 'LGU')
            .in('city', deployData.cities)

          if (userError) throw userError

          if (lguUsers && lguUsers.length > 0) {
            const notifPayload = lguUsers.map(u => ({
              user_id: u.id,
              type: 'event_deployment',
              title: 'New Event Deployment',
              message: `Event "${events.find(e => e.id === deployData.event_id)?.name || 'A disaster event'}" has been deployed to ${u.city}.`,
              data: { event_id: deployData.event_id, city: u.city }
            }))

            const { error: notifError } = await supabase.from('notifications').insert(notifPayload)
            if (notifError) console.error('Error inserting LGU notifications:', notifError)
            else console.log(`Successfully sent ${lguUsers.length} notifications to LGU users.`)
          }
        } catch (notifErr) {
          console.error('Non-fatal error sending LGU notifications:', notifErr)
          // We don't fail the whole deployment just because notifications failed
        }
        // ═══════════════════════════════════════════════
      }

      showSuccess('Success', 'Event deployed to LGUs successfully.');
      return true
    } catch (err) {
      console.error('Error deploying to LGU:', err)
      const errorMsg = err.message || 'Unknown error'
      const errorDetail = err.details || err.hint || ''
      alert(`Failed to deploy to LGUs:\n\n${errorMsg}\n\n${errorDetail}\n\n(Check console for full details)`)
      return false
    }
  }, [user, showSuccess])

  const deleteEvent = useCallback(async (id) => {
    if (!supabase) return
    try {
      console.log('Starting sequential deletion for event:', id)
      
      // 1. Fetch grandchild IDs to handle nested dependencies
      const { data: reportIds } = await supabase.from('reports').select('id').eq('event_id', id)
      const { data: roadsIds } = await supabase.from('roads_and_bridges').select('id').eq('event_id', id)

      // 2. Clear grandchildren
      if (reportIds && reportIds.length > 0) {
        await supabase.from('report_rows').delete().in('report_id', reportIds.map(r => r.id))
      }
      if (roadsIds && roadsIds.length > 0) {
        await supabase.from('roads_and_bridges_sections').delete().in('report_id', roadsIds.map(r => r.id))
      }

      // 3. Clear all child report tables and deployments
      const childTables = [
        'agriculture_damage_reports',
        'assistance_lgus_agencies_reports',
        'assistance_provided_reports',
        'class_suspension_reports',
        'communication_lines_reports',
        'damaged_houses_reports',
        'declaration_state_of_calamity_reports',
        'infrastructure_damage_reports',
        'power_reports',
        'pre_emptive_evacuation_reports',
        'related_incidents',
        'reports',
        'roads_and_bridges',
        'water_supply_reports',
        'work_suspension_reports',
        'event_deployments',
        'situational_reports' // situational_reports should be last among children
      ]

      for (const table of childTables) {
        const { error: deleteError } = await supabase.from(table).delete().eq('event_id', id)
        if (deleteError) {
          console.warn(`Non-fatal: Error clearing ${table}:`, deleteError.message)
          // We continue because some tables might not exist or be empty
        }
      }

      // 4. Finally delete the event itself
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error

      // 5. Update local state
      setEvents((prev) => prev.filter((e) => e.id !== id))
      if (currentEventId === id) setCurrentEventId(null)
      
      showToast('Event Deleted', 'The event and all its associated data have been removed.', 'success')
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event: ' + err.message)
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
      supabase.from('activity_logs').insert({ user_id: user.id, action: 'Selected event for report', details: `Event: ${event.name}` }).then(({ error }) => { if (error) console.error('Error logging event selection:', error) })
    }
    if (targetPath) navigate(targetPath)
  }, [targetPath, onSelectCallback, closeSelectEventModal, navigate, user])

  const switchEvent = useCallback((eventId) => {
    const event = events.find(e => e.id === eventId)
    if (user && event) {
      supabase.from('activity_logs').insert({ user_id: user.id, action: 'Switched dashboard event', details: `Event: ${event.name}` }).then(({ error }) => { if (error) console.error('Error logging event switch:', error) })
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
    createSituationalReport,
    updateSituationalReport,
    sendSituationalReport,
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
    deployEvent,
    deployToLgu,
    fetchEvents,
    fetchNotifications,
    pendingUsersCount,
    fetchPendingUsersCount,
    toast,
    showToast,
    closeToast
  }

  return (
    <EventContext.Provider value={value}>
      {children}
      {showSelectEventModal && createPortal(<SelectEventModal events={events} onClose={closeSelectEventModal} onSelect={confirmSelectEvent} />, document.body)}
      {successModal.show && createPortal(
        <div className="modal-overlay" onClick={closeSuccess}>
          <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-confirm">
              <div className="modal-confirm-icon modal-confirm-icon--success"><CheckCircle2 size={32} /></div>
              <h2 className="modal-confirm-title">{successModal.title || 'Success'}</h2>
              <p className="modal-confirm-text">{successModal.message}</p>
              <div className="modal-confirm-footer">
                <button type="button" className="modal-btn-primary" onClick={closeSuccess} style={{ minWidth: '120px' }}>Close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmModal.show && createPortal(
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-confirm">
              <div className={`modal-confirm-icon modal-confirm-icon--${confirmModal.type}`}>{confirmModal.type === 'danger' ? <AlertTriangle size={32} /> : <Info size={32} />}</div>
              <h2 className="modal-confirm-title">{confirmModal.title}</h2>
              <p className="modal-confirm-text">{confirmModal.message}</p>
              <div className="modal-confirm-footer">
                <button type="button" className="modal-btn-cancel" onClick={closeConfirm}>{confirmModal.cancelText}</button>
                <button type="button" className={`modal-btn-${confirmModal.type}`} onClick={handleConfirmAction}>{confirmModal.confirmText}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="select-event-modal-title">
      <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2 id="select-event-modal-title">Select Event</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p className="event-modal-subtitle" style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>Choose an active event for this report.</p>
          {events.length === 0 ? (
            <div className="event-modal-empty">
              <PlusCircle className="event-modal-empty-icon" size={32} />
              <p style={{ fontSize: '0.8125rem' }}>No active events found.</p>
              <button type="button" className="modal-btn-primary" onClick={onClose} style={{ margin: '1rem auto' }}>Go to Dashboard</button>
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
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-btn-cancel" onClick={onClose}>Cancel</button>
          {events.length > 0 && <button type="button" className="modal-btn-primary" onClick={() => selected && onSelect(selected)} disabled={!selectedId}>Continue<ChevronRight size={16} /></button>}
        </div>
      </div>
    </div>
  )
}
