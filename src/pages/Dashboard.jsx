import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import LoadingSpinner from '../components/LoadingSpinner'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { ArrowsClockwise, DotsThree, ArrowRight, TrendUp, TrendDown, CaretLeft, CaretRight, Pencil, Warning, CloudRain, Pulse, Flame, Info, Check, Calendar, Bell, X, ChartBar as BarChartIcon, ChartPie as PieChartIcon, ChartLineUp as LineChartIcon, ShieldCheck, PaperPlaneRight, MagnifyingGlass, Hurricane, Drop, Waveform, Waves, CloudWarning, WarningCircle } from '@phosphor-icons/react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  CartesianGrid,
  Legend
} from 'recharts'
import { useEvents } from '../contexts/EventContext'
import api from '../lib/api'
import regionData, { getCityForBarangay, getBarangaysForCity } from '../data/locations'
import { PROVINCE_NAMES, getCitiesForProvince, getProvinceForCity } from '../data/provinces'
import '../styles/pages/PageStyles.css'
import '../styles/pages/Dashboard.css'
import '../styles/components/EventModal.css'
import SearchableSelect from '../components/SearchableSelect'
import ModernDateTimePicker from '../components/ModernDateTimePicker'
import NotificationBell from '../components/NotificationBell'
import HeaderFooterModal from '../components/HeaderFooterModal'
import Button from '../components/Button'
import ConfirmationModal from '../components/ConfirmationModal'

const CATEGORY_LABELS = {
  relatedIncidents: 'Related Incidents',
  affectedPopulation: 'Affected Population',
  assistanceLgus: 'Assistance (LGUs/Agencies)',
  agricultureDamage: 'Agriculture Damage',
  infrastructureDamage: 'Infrastructure Damage',
  roadsAndBridges: 'Roads and Bridges',
  power: 'Power',
  waterSupply: 'Water Supply',
  communicationLines: 'Communication Lines',
  damagedHouses: 'Damaged Houses',
  classSuspension: 'Class Suspension',
  workSuspension: 'Work Suspension',
  stateOfCalamity: 'Declaration of State of Calamity',
  preEmptiveEvacuation: 'Pre-emptive Evacuation',
  assistanceProvided: 'Assistance Provided to Affected Families',
}

const CATEGORY_ICONS = {
  relatedIncidents: <Pulse size={18} />,
  affectedPopulation: <Warning size={18} />,
  assistanceLgus: <Check size={18} />,
  agricultureDamage: <Pulse size={18} />,
  infrastructureDamage: <DotsThree size={18} />,
  roadsAndBridges: <ArrowRight size={18} />,
  power: <Pulse size={18} />,
  waterSupply: <CloudRain size={18} />,
  communicationLines: <Pulse size={18} />,
  damagedHouses: <Flame size={18} />,
  classSuspension: <Calendar size={18} />,
  workSuspension: <Calendar size={18} />,
  stateOfCalamity: <Warning size={18} />,
  preEmptiveEvacuation: <ArrowRight size={18} />,
  assistanceProvided: <Check size={18} />,
}

const EVENT_TYPE_ICONS = {
  typhoon: <Hurricane size={32} weight="duotone" />,
  flood: <Drop size={32} weight="duotone" />,
  earthquake: <Waveform size={32} weight="duotone" />,
  tsunami: <Waves size={32} weight="duotone" />,
  weather: <CloudWarning size={32} weight="duotone" />,
  calamity: <WarningCircle size={32} weight="duotone" />,
}

const TYPHOON_NAMES = [
  'Ada', 'Basyang', 'Caloy', 'Domeng', 'Ester', 'Francisco',
  'Gardo', 'Henry', 'Inday', 'Josie', 'Kiyapo', 'Luis',
  'Maymay', 'Neneng', 'Obet', 'Pilandok', 'Queenie', 'Rosal',
  'Samuel', 'Tomas', 'Umberto', 'Venus', 'Waldo', 'Yayang', 'Zeny',
  'Alpas', 'Bagwis', 'Chona', 'Diwa', 'Eloy', 'Felix', 'Gerard', 'Hiyas', 'Ismael', 'Jerome'
]

// Philippine standard alert / warning levels per event type
const ALERT_LEVELS = {
  typhoon: [
    { value: '', label: '— Select Category —' },
    { value: 'Tropical Depression', label: '🌀 Tropical Depression (TD) — ≤ 61 km/h' },
    { value: 'Tropical Storm', label: '🌀 Tropical Storm (TS) — 62–88 km/h' },
    { value: 'Severe Tropical Storm', label: '🌀 Severe Tropical Storm (STS) — 89–117 km/h' },
    { value: 'Typhoon', label: '🌀 Typhoon (TY) — 118–184 km/h' },
    { value: 'Super Typhoon', label: '🌀 Super Typhoon (STY) — ≥ 185 km/h' },
  ],
  earthquake: [
    { value: '', label: '— Select Intensity —' },
    { value: 'Intensity I', label: '🏔 Intensity I — Scarcely perceptible (instruments only)' },
    { value: 'Intensity II', label: '🏔 Intensity II — Slightly felt (few people at rest)' },
    { value: 'Intensity III', label: '🏔 Intensity III — Weak (hanging objects sway)' },
    { value: 'Intensity IV', label: '🏔 Intensity IV — Moderately strong (minor rattling)' },
    { value: 'Intensity V', label: '🏔 Intensity V — Strong (some objects fall, minor cracks)' },
    { value: 'Intensity VI', label: '🏔 Intensity VI — Very strong (light structural damage)' },
    { value: 'Intensity VII', label: '🏔 Intensity VII — Destructive (cracks in walls)' },
    { value: 'Intensity VIII', label: '🏔 Intensity VIII — Very destructive (severe structure damage)' },
    { value: 'Intensity IX', label: '🏔 Intensity IX — Devastating (most structures collapsed)' },
    { value: 'Intensity X', label: '🏔 Intensity X — Completely devastating (total destruction)' },
  ],
  tsunami: [
    { value: '', label: '— Select Warning Level —' },
    { value: 'Information', label: '🌊 Information — Monitoring; no wave expected' },
    { value: 'Advisory', label: '🌊 Advisory — Small waves possible; stay away from shoreline' },
    { value: 'Watch', label: '🌊 Watch — Destructive waves possible; prepare to evacuate' },
    { value: 'Warning', label: '🌊 Warning — Destructive waves expected; evacuate immediately' },
  ],
  flood: [
    { value: '', label: '— Select Alert Level —' },
    { value: 'Alert Level 1', label: '💧 Alert Level 1 — Low flooding; monitor situation' },
    { value: 'Alert Level 2', label: '💧 Alert Level 2 — Moderate flooding; prepare for evacuation' },
    { value: 'Alert Level 3', label: '💧 Alert Level 3 — Critical/severe flooding; evacuate immediately' },
  ],
  calamity: [
    { value: '', label: '— Select Advisory —' },
    { value: 'Special Weather Advisory', label: '🌦 Special Weather Advisory — Localized heavy rains' },
    { value: 'Yellow Warning', label: '🌦 Yellow Warning — Moderate to heavy rainfall 15–30 mm/hr' },
    { value: 'Orange Warning', label: '🌦 Orange Warning — Heavy to intense rainfall 30–60 mm/hr' },
    { value: 'Red Warning', label: '🌦 Red Warning — Intense to torrential rainfall >60 mm/hr' },
  ],
  fire: [
    { value: '', label: '— Select Level —' },
    { value: 'First Alarm', label: '🔥 First Alarm — Localized fire; single response unit' },
    { value: 'Second Alarm', label: '🔥 Second Alarm — Growing fire; multiple units responding' },
    { value: 'Third Alarm', label: '🔥 Third Alarm — Major fire; full response deployment' },
  ],
}


function addToCityCounts(city, category, totalByCity, byCityCategory) {
  if (!city) return
  totalByCity[city] = (totalByCity[city] || 0) + 1
  if (!byCityCategory[city]) byCityCategory[city] = {}
  byCityCategory[city][category] = (byCityCategory[city][category] || 0) + 1
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

const CARD_WIDTH = 200
const CARD_GAP = 16
const CARD_STEP = CARD_WIDTH + CARD_GAP

const CustomizedAxisTick = (props) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      {words.map((word, i) => (
        <text
          key={i}
          x={0}
          y={i * 11}
          dy={12}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{ fontSize: 9, fontWeight: 500 }}
        >
          {word}
        </text>
      ))}
    </g>
  );
};

export default function Dashboard() {
  const { user } = useOutletContext() ?? {}
  const { 
    currentEvent: rawCurrentEvent, 
    currentEventId, 
    events, 
    loading: eventsLoading, 
    addEvent, 
    updateEvent, 
    deleteEvent, 
    setCurrentEventId, 
    switchEvent, 
    userSignal,
    socket 
  } = useEvents()

  const SIGNAL_COLORS = {
    '1': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }, // Yellow
    '2': { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' }, // Orange
    '3': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }, // Red
    '4': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }, // Pink
    '5': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' }, // Purple
  }

  const currentEvent = useMemo(() => {
    if (rawCurrentEvent?.isDeployed && rawCurrentEvent?.deployedSnapshot) {
      return {
        ...rawCurrentEvent.deployedSnapshot,
        ...rawCurrentEvent,
        // Ensure we keep the actual ID from the raw event
        id: rawCurrentEvent.id
      }
    }
    return rawCurrentEvent
  }, [rawCurrentEvent])
  const isLguUser = user?.account_type === 'LGU' || user?.account_type === 'LGU Admin'
  const isProvincialUser = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin' || user?.account_type === 'Provincial Approver'
  const isRegionalUser = user?.account_type === 'Regional' || user?.account_type === 'Regional Admin' || user?.role === 'Super Admin' || user?.account_type === 'Super Admin'

  const provinceFilter = isProvincialUser ? (user?.province || null) : null
  const canManageEvents = isProvincialUser || isRegionalUser
  const T = {
    blue: '#3b82f6',    // Vivid Blue
    purple: '#8b5cf6',  // Vivid Purple
    teal: '#14b8a6',    // Vivid Teal
    orange: '#f97316',  // Vivid Orange
    amber: '#fbbf24',   // Vivid Amber
    rose: '#f43f5e',    // Vivid Rose
    indigo: '#6366f1',  // Vivid Indigo
    red: '#ef4444',     // Vivid Red
    slate: '#475569',   // Slate
    dark: '#1e293b'     // Dark
  }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const trackRef = useRef(null)
  // In-memory cache: eventId → fetchData result (cleared on manual refresh)
  const cacheRef = useRef({})
  const [centerCardIndex, setCenterCardIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const prevStepRef = useRef(-1)
  const [showEditEventModal, setShowEditEventModal] = useState(false)
  const [showSignalDetailsModal, setShowSignalDetailsModal] = useState(false)
  const [signalSearchTerm, setSignalSearchTerm] = useState('')
  const [activeSignalTab, setActiveSignalTab] = useState('lgus')
  const [showSelectEventToEdit, setShowSelectEventToEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedEventIdToEdit, setSelectedEventIdToEdit] = useState('')
  const [isEditingExistingEvent, setIsEditingExistingEvent] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', color: '#6366f1', startDate: '', endDate: '', eventType: 'calamity', alertStatus: 'white', pingedReportTypes: [] })
  const [activeTab, setActiveTab] = useState('All Reports')
  const [selectedDashboardSitRepId, setSelectedDashboardSitRepId] = useState('')
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false)
  const [sitRepDropdownOpen, setSitRepDropdownOpen] = useState(false)
  const [showAffectedPersonsModal, setShowAffectedPersonsModal] = useState(false)
  const eventDropdownRef = useRef(null)
  const sitRepDropdownRef = useRef(null)
  const tabsRef = useRef(null)
  const isDragging = useRef(false)
  const isMouseDown = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('readAlerts') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(e.target)) {
        setEventDropdownOpen(false)
      }
      if (sitRepDropdownRef.current && !sitRepDropdownRef.current.contains(e.target)) {
        setSitRepDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // New LGU Deployment Modal state
  const [showLguDeploymentModal, setShowLguDeploymentModal] = useState(false)
  const [selectedEventToDeploy, setSelectedEventToDeploy] = useState(null)
  const [lguForm, setLguForm] = useState({
    cities: [],
    strengthLabel: 'Rainfall',
    strengthValue: 'Light'
  })

  // Scroll lock for Deploy to LGUs modal
  useEffect(() => {
    if (showLguDeploymentModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showLguDeploymentModal])

  const {
    deployToLgu,
    notifications: dbNotifications,
    fetchNotifications,
    eventDeployments,
    fetchEventDeployments,
    eventSignals,
    fetchEventSignals,
    assignSignal,
    bulkAssignSignals
  } = useEvents()

  const handleNotificationClick = (notif) => {
    if (notif.type === 'event_deployment') {
      // Prevent LGU users from triggering the deployment modal
      if (user?.account_type === 'LGU') {
        console.log('LGU users cannot trigger event deployment modal');
        return;
      }

      const data = typeof notif.data === 'string' ? JSON.parse(notif.data) : notif.data
      const eventId = data?.event_id
      if (event) {
        // Instead of showing the deployment checkbox modal (Image 1),
        // we now show the signal management modal (Image 2)
        setSelectedEventToDeploy(event)
        fetchEventSignals(eventId)
        setShowSignalDetailsModal(true)
      }
    }
  }

  const handleLguDeploySubmit = async (e) => {
    e.preventDefault()
    if (!selectedEventToDeploy || lguForm.cities.length === 0) return

    const success = await deployToLgu({
      event_id: selectedEventToDeploy.id,
      province: user.province,
      cities: lguForm.cities,
      strength_label: lguForm.strengthLabel,
      strength_value: lguForm.strengthValue
    })

    if (success) {
      setShowLguDeploymentModal(false)
    }
  }

  const notifications = useMemo(() => {
    const items = []

    if (currentEvent && currentEvent.pingedReportTypes?.length > 0) {
      const needed = currentEvent.pingedReportTypes.map(k => CATEGORY_LABELS[k] || k).join(', ')
      items.push({
        id: `pending-${currentEvent.id}`,
        icon: <Bell size={16} color="#f59e0b" />,
        title: 'Reports Needed',
        desc: `Required for ${currentEvent.name}: ${needed}`,
        time: 'Active'
      })
    }

    if (currentEvent && currentEvent.approvalStatus === 'Approved') {
      items.push({
        id: `appr-${currentEvent.id}`,
        icon: <Bell size={16} color="#10b981" />,
        title: 'Report Approved',
        desc: `The consolidated report for ${currentEvent.name} has been approved.`,
        time: 'Recent'
      })
    }

    if (currentEvent && currentEvent.id !== 'default-good-day') {
      items.push({
        id: `evt-${currentEvent.id}`,
        icon: <Bell size={16} color="#3b82f6" />,
        title: 'Active Event',
        desc: `Currently monitoring: ${currentEvent.name}`,
        time: 'Now'
      })
    }

    return items
  }, [currentEvent])

  const unreadCount = notifications.filter(n => !dismissedNotifs.includes(n.id)).length

  const handleNotifClick = (id) => {
    if (!dismissedNotifs.includes(id)) {
      const updated = [...dismissedNotifs, id]
      setDismissedNotifs(updated)
      localStorage.setItem('readAlerts', JSON.stringify(updated))
    }
  }

  // Helper to parse summary into Overview and Timeline — memoized so regex only runs when data changes
  const parsedSummary = useMemo(() => {
    // Default details from eventType
    let details = currentEvent?.eventType ? currentEvent.eventType.replace(/_/g, ' ') : null;

    if (!currentEvent?.summary) return { overview: '', timeline: [], details };

    // Split by common headers used in summaryService.js
    const parts = currentEvent.summary.split(/CHRONOLOGY OF EVENTS(?::)?/i);
    let overview = parts[0].trim();
    let timeline = [];

    // Remove "EXECUTIVE SUMMARY" header if present
    overview = overview.replace(/^EXECUTIVE SUMMARY/i, '').trim();

    // Extract classification details for sub-header
    if (overview) {
      // More robust regex for various technical fields
      const cMatch = overview.match(/(?:Classification|Category|Wave Height Classification)\*?:\s*(.*)/i);
      const mMatch = overview.match(/(?:Magnitude|Mw)\s*\(Mw\)?\*?:\s*(.*)/i);
      const iMatch = overview.match(/(?:Intensity|PEIS)\s*\(PEIS\)?\*?:\s*(.*)/i);
      const dMatch = overview.match(/Depth\*?:\s*(.*)/i);
      const wMatch = overview.match(/(?:Warning Signal|Signal|Category)\*?:\s*(.*)/i);
      const pMatch = overview.match(/(?:PTWC|Tsunami Level)\*?:\s*(.*)/i);
      const sMatch = overview.match(/Status\*?:\s*(.*)/i);

      const strip = (str) => {
        if (!str) return '';
        const cleaned = str.replace(/[\*_]/g, '').trim();
        const low = cleaned.toLowerCase();
        // Filter out placeholders
        if (low.includes('select') ||
          low === 'none' ||
          low === 'unknown' ||
          low === 'none assigned' ||
          low === 'not selected' ||
          low === ''
        ) return '';
        return cleaned;
      };

      const parts_list = [];
      const eventType = currentEvent?.eventType?.toLowerCase() || '';

      if (eventType === 'typhoon') {
        const classification = strip(cMatch?.[1]);
        const signal = strip(wMatch?.[1]);
        if (classification) parts_list.push(classification);
        if (signal) {
          const signalNum = signal.replace(/signal\s*/i, '').trim();
          if (signalNum) parts_list.push(`SIGNAL ${signalNum}`);
        }
      } else if (eventType === 'earthquake') {
        const magnitude = strip(mMatch?.[1]);
        const intensity = strip(iMatch?.[1]);
        const depth = strip(dMatch?.[1]);
        if (magnitude) parts_list.push(`Mw ${magnitude}`);
        if (intensity) parts_list.push(`INTENSITY ${intensity}`);
        if (depth) parts_list.push(`DEPTH: ${depth}`);
      } else if (eventType === 'tsunami') {
        const waveHeight = strip(cMatch?.[1]);
        const ptwc = strip(pMatch?.[1]);
        const signal = strip(wMatch?.[1]);
        if (waveHeight) parts_list.push(waveHeight);
        if (ptwc) parts_list.push(`PTWC: ${ptwc}`);
        if (signal) parts_list.push(`SIGNAL ${signal}`);
      } else {
        // Fallback for general calamities
        const classification = strip(cMatch?.[1]);
        const status = strip(sMatch?.[1]);
        if (classification) parts_list.push(classification);
        else if (status) parts_list.push(status);
      }

      if (parts_list.length > 0) {
        details = parts_list.join(' | ').toUpperCase();
      }

      // Prepend explicit alertLevel if provided and not already in details
      if (currentEvent?.alertLevel) {
        const level = currentEvent.alertLevel.toUpperCase();
        if (!details || !details.includes(level)) {
          details = details ? `${level} | ${details}` : level;
        }
      }
    }

    if (parts.length > 1) {
      // Parse bullet points: "- At 10:00, something happened" or "On Date: \n- At Time, ..."
      const timelinePart = parts[1];
      const lines = timelinePart.split('\n').filter(l => l.trim());

      let currentDate = '';
      lines.forEach(line => {
        const dateMatch = line.match(/On (.*):/i);
        if (dateMatch) {
          currentDate = dateMatch[1];
        } else if (line.trim().startsWith('-')) {
          const text = line.replace(/^-/, '').trim();
          // Extract time if present "At 10:00 AM, ..."
          const timeMatch = text.match(/At (.*?),/i);
          const time = timeMatch ? timeMatch[1] : '';
          const content = time ? text.replace(`At ${time},`, '').trim() : text;

          timeline.push({
            timeOrigin: time,
            date: currentDate,
            timeLabel: time || currentDate || 'Update',
            text: content
          });
        } else {
          // Check for other sections and stop parsing if reached (e.g. IMPACT OVERVIEW)
          if (line.match(/IMPACT OVERVIEW|INFRASTRUCTURE STATUS|HOUSING & DISPLACEMENT|GOVERNMENT ACTIONS|RESPONSE EFFORTS/i)) {
            return;
          }
          timeline.push({ timeLabel: 'Update', text: line.trim() });
        }
      });
    }

    // Fallback: build timeline from actual incident data if summary has none
    if (timeline.length === 0 && result?.details?.incidents?.length > 0) {
      const sorted = [...result.details.incidents]
        .filter(inc => inc.date || inc.created_at)
        .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));

      sorted.forEach(inc => {
        const d = new Date(inc.date || inc.created_at);
        const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        let timeStr = '';
        if (inc.time) {
          const s = String(inc.time);
          if (s.includes(':')) {
            const [h, m] = s.split(':');
            const hour = parseInt(h, 10);
            if (!isNaN(hour)) {
              const ampm = hour >= 12 ? 'PM' : 'AM';
              const h12 = hour % 12 || 12;
              timeStr = `${h12}:${m ? m.split(':')[0] : '00'} ${ampm}`;
            }
          }
        }
        const label = timeStr ? `${dateStr} ${timeStr}` : (dateStr || 'Update');
        const desc = inc.description || `${inc.type || 'Incident'} in ${inc.loc || inc.city || 'area'} — ${inc.status || 'reported'}`;
        timeline.push({ timeLabel: label, text: desc });
      });
    }

    return { overview, timeline, details };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.summary, currentEvent?.eventType, currentEvent?.id, result]);



  const handleMouseDown = (e) => {
    isMouseDown.current = true
    isDragging.current = false
    startX.current = e.pageX - tabsRef.current.offsetLeft
    scrollLeft.current = tabsRef.current.scrollLeft
    tabsRef.current._startX = e.pageX
    tabsRef.current._lastX = e.pageX - tabsRef.current.offsetLeft
  }

  const handleMouseLeave = () => {
    isMouseDown.current = false
    isDragging.current = false
    if (tabsRef.current) tabsRef.current.classList.remove('dragging')
  }

  const handleMouseUp = () => {
    isMouseDown.current = false
    setTimeout(() => {
      isDragging.current = false
      if (tabsRef.current) tabsRef.current.classList.remove('dragging')
    }, 50)
  }

  const handleMouseMove = (e) => {
    if (!isMouseDown.current || !tabsRef.current) return

    const x = e.pageX - tabsRef.current.offsetLeft
    const dx = x - (tabsRef.current._lastX || x)
    tabsRef.current._lastX = x

    if (!isDragging.current) {
      if (Math.abs(e.pageX - (tabsRef.current._startX || 0)) < 5) return
      isDragging.current = true
      tabsRef.current.classList.add('dragging')
    }

    e.preventDefault()
    tabsRef.current.scrollLeft -= dx * 2
  }

  // Pre-build a lookup map for faster $O(1)$ barangay-to-city translation
  // we do this outside the component or once to avoid $O(N \cdot M)$ searches in every loop
  const [barangayMap] = useState(() => {
    const map = new Map()
    if (regionData && regionData.lgus) {
      for (const lgu of regionData.lgus) {
        for (const brgy of lgu.barangays) {
          map.set(brgy.toLowerCase(), lgu.name)
        }
      }
    }
    return map
  })

  // Lookup function using the map
  const toCity = useCallback((barangay) => {
    if (!barangay) return 'Unknown'
    const b = barangay.toLowerCase()
    const mapped = barangayMap.get(b)
    if (mapped) return mapped
    return (barangay === 'Entire Municipality' ? 'Municipality-wide' : barangay) || 'Unknown'
  }, [barangayMap])

  const fetchData = useCallback(async () => {
    if (!currentEventId || currentEventId === 'default-good-day') {
      return {
        topCity: null, total: 0, totalTrend: 0, top4: [], categoryCards: [],
        overviewData: [], trendChartData: [],
        details: {
          sexDistribution: { male: 0, female: 0 },
          evacStatus: { inside: 0, outside: 0, total: 0 },
          byProvince: {},
          byCity: {},
          infrastructure: [],
          incidents: [],
          suspensions: [],
          preEvacuation: [],
          assistanceByLgu: {},
          agriByCity: {},
          agriByClass: {},
          infraDamage: [],
          damagedHouses: [],
          commLines: [],
          assistance: []
        }
      }
    }

    // Fetch all SitReps for this event
    const { data: allSitreps } = await api.get('/situational-reports', {
      params: { event_id: currentEventId }
    })

    // Group by province and find latest approved for aggregation
    const latestApprovedPerProvince = (allSitreps || []).reduce((acc, sr) => {
      if (sr.status === 'Approved') {
        const prov = sr.province || 'Unknown'
        if (!acc[prov] || new Date(sr.created_at) > new Date(acc[prov].created_at)) {
          acc[prov] = sr
        }
      }
      return acc
    }, {})

    let approvedIdsCsv = ''
    let approvedIds = []
    if (selectedDashboardSitRepId) {
      approvedIdsCsv = selectedDashboardSitRepId
      approvedIds = [selectedDashboardSitRepId]
    } else {
      approvedIds = Object.values(latestApprovedPerProvince).map(s => s.id)
      approvedIdsCsv = approvedIds.join(',') || '00000000-0000-0000-0000-000000000000'
    }

    if (approvedIds.length === 0) {
      console.warn('[Dashboard] No situational reports with "Approved" status found for event:', currentEventId)
    }

    const lguCityFilter = isLguUser ? (user?.city || null) : null


    let referenceDate = new Date()
    // If the event is in the past or future, center our "Current" window around its startDate
    if (currentEvent?.startDate) {
      const eventStart = new Date(currentEvent.startDate)
      // If event started more than 7 days ago or is in the future, use its startDate as the reference for "Now" in the context of this event
      const diffDays = Math.abs(referenceDate - eventStart) / (1000 * 60 * 60 * 24)
      if (diffDays > 7) {
        referenceDate = eventStart
        // Move it forward a bit so we see the first few days as "Current"
        referenceDate.setDate(referenceDate.getDate() + 3)
      }
    }

    const sevenDaysAgo = new Date(referenceDate)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fourteenDaysAgo = new Date(referenceDate)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const sinceISO = sevenDaysAgo.toISOString()
    const prevSinceISO = fourteenDaysAgo.toISOString()

    const totalByCity = {}
    const byCityCategory = {}
    const prevTotalByCity = {}
    const prevByCityCategory = {}
    const byBarangayCategory = {}

    const tables = [
      { table: 'related_incidents', category: 'relatedIncidents', col: 'barangay', dateCol: 'created_at' },
      { table: 'roads_and_bridges', category: 'roadsAndBridges', col: 'barangay', dateCol: 'created_at' },
      { table: 'power_reports', category: 'power', col: 'barangay', dateCol: 'created_at' },
      { table: 'communication_lines_reports', category: 'communicationLines', col: 'barangay', dateCol: 'created_at' },
      { table: 'damaged_houses_reports', category: 'damagedHouses', col: 'barangay', dateCol: 'created_at' },
      { table: 'class_suspension_reports', category: 'classSuspension', col: 'barangay', dateCol: 'created_at' },
      { table: 'work_suspension_reports', category: 'workSuspension', col: 'barangay', dateCol: 'created_at' },
      { table: 'declaration_state_of_calamity_reports', category: 'stateOfCalamity', col: 'barangay', dateCol: 'resolution_date' },
      { table: 'pre_emptive_evacuation_reports', category: 'preEmptiveEvacuation', col: 'barangay', dateCol: 'created_at' },
      { table: 'assistance_provided_reports', category: 'assistanceProvided', col: 'barangay', dateCol: 'created_at' },
      { table: 'assistance_lgus_agencies_reports', category: 'assistanceLgus', col: 'barangay', dateCol: 'created_at' },
      { table: 'agriculture_damage_reports', category: 'agricultureDamage', col: 'barangay', dateCol: 'created_at' },
      { table: 'infrastructure_damage_reports', category: 'infrastructureDamage', col: 'barangay', dateCol: 'created_at' },
    ]

    const dayCounts = {}
    for (let i = 10; i >= 0; i--) {
      const d = new Date(referenceDate)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dayCounts[dateStr] = 0
    }

    const addToStats = (category, barangay, amount, dateStr, cityOverride) => {
      const city = cityOverride || toCity(barangay)
      const isCurrent = dateStr >= sinceISO
      const isPrevious = dateStr >= prevSinceISO && dateStr < sinceISO

      // Always populate event-wide statistics regardless of the 7-day chart window
      totalByCity[city] = (totalByCity[city] || 0) + 1
      if (!byCityCategory[city]) byCityCategory[city] = {}
      byCityCategory[city][category] = (byCityCategory[city][category] || 0) + amount

      byBarangayCategory[category] = byBarangayCategory[category] || {}
      const b = barangay || 'N/A'
      byBarangayCategory[category][b] = (byBarangayCategory[category][b] || 0) + amount

      if (isCurrent) {
        const d = dateStr.split('T')[0]
        if (dayCounts[d] !== undefined) dayCounts[d] += 1
      } else if (isPrevious) {
        prevTotalByCity[city] = (prevTotalByCity[city] || 0) + 1
        if (!prevByCityCategory[city]) prevByCityCategory[city] = {}
        prevByCityCategory[city][category] = (prevByCityCategory[city][category] || 0) + amount
      }
    }

    // Enhanced details for deep integration components
    const details = {
      sexDistribution: { male: 0, female: 0 },
      evacStatus: { inside: 0, outside: 0, total: 0 },
      byProvince: {}, // { 'Pangasinan': { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: Set } }
      byCity: {},
      infrastructure: [],
      incidents: [],
      suspensions: [],
      preEvacuation: [],
      assistanceByLgu: {},
      agriByCity: {},
      agriByClass: {},
      infraDamage: [],
      populationByLgu: {},
      commLines: [],
      damagedHouses: [], // Added to fix push error
      ageTally: { kids: 0, adults: 0, seniors: 0 },
      sitRepStatus: allSitreps || []
    }

    // Helper for deduplicating infrastructure
    const latestInfra = {};

    // 1. Fetch 14 days of data for all standard tables in parallel
    const tablePromises = tables.map(async ({ table, category, col, dateCol }) => {
      const { data } = await api.get(`/reports/${table}`, {
        params: { 
          event_id: currentEventId,
          situational_report_id: approvedIdsCsv
        }
      })

      if (data) data.forEach(row => {
        let amount = 1;
        const brgy = row[col];
        const city = row.city || row.mun || toCity(brgy);
        const province = getProvinceForCity(city) || 'Unknown';

        // Hierarchical Filter Scoping
        const isLguUser = user?.account_type === 'LGU' || user?.account_type === 'LGU Admin'
        const isProvincialUser = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin' || user?.account_type === 'Provincial Approver'
        
        if (isLguUser && city !== user?.city) return
        if (isProvincialUser && province !== user?.province) return

        // Initialize province stats
        if (!details.byProvince[province]) {
          details.byProvince[province] = { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: new Set() };
        }
        if (!details.byCity[city]) {
          details.byCity[city] = { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: new Set() };
        }
        if (brgy) {
          details.byProvince[province].brgys.add(brgy);
          details.byCity[city].brgys.add(brgy);
        }

        if (category === 'damagedHouses') {
          const total = Number(row.totally_damaged || 0);
          const partial = Number(row.partially_damaged || 0);
          amount = total + partial;
          details.damagedHouses.push({ name: brgy, city, total, partial });
          details.byProvince[province].dmg += amount;
          details.byCity[city].dmg += amount;
          details.byCity[city].dmg_total = (details.byCity[city].dmg_total || 0) + total;
          details.byCity[city].dmg_partial = (details.byCity[city].dmg_partial || 0) + partial;
        }
        if (category === 'communicationLines') {
          const key = `comm-${city}-${brgy}`;
          if (!latestInfra[key] || new Date(row.created_at) > new Date(latestInfra[key].created_at)) {
            latestInfra[key] = { ...row, category, city, brgy, province };
          }
          details.commLines.push({ name: brgy, city, status: row.status_of_communication });
        }
        if (category === 'assistanceProvided') {
          amount = Number(row.no_families_assisted || 0);
          details.assistanceByLgu[city] = (details.assistanceByLgu[city] || 0) + Number(row.fnfi_amount || 0);
          details.byProvince[province].served += amount;
          details.byCity[city].served += amount;
        }

        // Populate specific logs for the "Deep Integration" views
        if (category === 'relatedIncidents') {
          details.incidents.push({ type: row.type_of_incident, loc: brgy, city, status: row.status, date: row.date_of_occurrence, time: row.time_of_occurrence, description: row.description, created_at: row.created_at });
        }
        if (category === 'power') {
          const key = `power-${city}-${brgy}`;
          if (!latestInfra[key] || new Date(row.created_at) > new Date(latestInfra[key].created_at)) {
            latestInfra[key] = { ...row, category, city, brgy, province };
          }
        }

        if (category === 'roadsAndBridges') {
          const key = `road-${city}-${brgy}`;
          if (!latestInfra[key] || new Date(row.created_at) > new Date(latestInfra[key].created_at)) {
            latestInfra[key] = { ...row, category, city, brgy, province };
          }
        }
        if (category === 'preEmptiveEvacuation') {
          amount = Number(row.families || row.total || 0);
          details.sexDistribution.male += Number(row.male_count || 0);
          details.sexDistribution.female += Number(row.female_count || 0);
          details.preEvacuation.push({
            mun: city,
            fam: Number(row.families || 0),
            per: Number(row.total || 0),
            ec: '-'
          });
        }
        if (['classSuspension', 'workSuspension', 'stateOfCalamity'].includes(category)) {
          details.suspensions.push({ name: brgy, city, province, type: category, status: row.status });
        }

        if (category === 'assistanceLgus') {
          amount = Number(row.amount || 0);
          details.assistanceByLgu[city] = (details.assistanceByLgu[city] || 0) + amount;
        }

        if (category === 'agricultureDamage') {
          amount = Number(row.production_loss_value || 0);
          const val = Number(row.production_loss_value || 0);
          const cls = row.classification || 'Other';
          details.agriByCity[city] = (details.agriByCity[city] || 0) + val;
          details.agriByClass[cls] = (details.agriByClass[cls] || 0) + val;
        }

        if (category === 'infrastructureDamage') {
          amount = Number(row.cost || 0);
          const infraType = (row.type || '').toLowerCase();
          const isPowerRelated = infraType.includes('power') || infraType.includes('electric');
          const isWaterRelated = infraType.includes('water');
          
          details.infraDamage.push({
            name: row.infrastructure_name || brgy,
            city,
            type: row.type || 'infrastructure',
            status: row.status,
            cost: Number(row.cost || 0),
            qty: row.quantity
          });

          // Map to general infrastructure status if type matches
          if (isPowerRelated) {
            const isOngoing = (row.status || '').toLowerCase().includes('ongoing') || (row.status || '').toLowerCase().includes('damaged');
            const statusStr = isOngoing ? 'interrupted' : 'restored';
            details.infrastructure.push({ name: row.infrastructure_name || brgy, city, type: 'power', status: statusStr });
            
            if (isOngoing) {
              details.byProvince[province].powerInt++;
              details.byCity[city].powerInt++;
            } else {
              details.byProvince[province].powerRes++;
              details.byCity[city].powerRes++;
            }
          } else if (isWaterRelated) {
            const isOngoing = (row.status || '').toLowerCase().includes('ongoing') || (row.status || '').toLowerCase().includes('damaged');
            details.infrastructure.push({ name: row.infrastructure_name || brgy, city, type: 'water', status: isOngoing ? 'interrupted' : 'operational' });
          } else {
            details.infrastructure.push({ name: row.infrastructure_name || brgy, city, type: 'infrastructure', status: row.status });
          }
        }

        addToStats(category, brgy, amount, row[dateCol], city)
      })
    })

    // 2. Fetch 14 days of Reports/Rows
    const reportsPromise = (async () => {
      try {
        const { data: reportsData } = await api.get('/reports/reports', {
          params: { event_id: currentEventId, situational_report_id: approvedIdsCsv }
        })

        if (!reportsData || reportsData.length === 0) {
          console.log('[Dashboard] No reports found for event:', currentEventId)
          return
        }

        const reportIds = reportsData.map(r => r.id)
        const { data: rowsData } = await api.get('/reports/report_rows', {
          params: { report_id: reportIds.join(',') }
        })

        if (!rowsData) return

        // Map rows back to reports
        const reportsWithRows = reportsData.map(report => ({
          ...report,
          report_rows: rowsData.filter(row => row.report_id === report.id)
        }))
        
        reportsWithRows.forEach(report => {
          if (!report.report_rows || report.report_rows.length === 0) return
          report.report_rows.forEach(row => {
            if (!row.barangay) return
            const fam = Number(row?.affected_families ?? 0) || 0
            const per = Number(row?.affected_persons ?? 0) || 0
            const inFam = Number(row?.inside_families_now ?? 0) || 0
            const outFam = Number(row?.outside_families_now ?? 0) || 0
            const city = row.city || toCity(row.barangay);
            const province = getProvinceForCity(city) || 'Unknown';

            // Hierarchical Filter Scoping
            const isLguUser = user?.account_type === 'LGU' || user?.account_type === 'LGU Admin'
            const isProvincialUser = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin' || user?.account_type === 'Provincial Approver'
            
            if (isLguUser && city !== user?.city) return
            if (isProvincialUser && province !== user?.province) return

            if (!details.byProvince[province]) {
              details.byProvince[province] = { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: new Set() };
            }
            if (!details.byCity[city]) {
              details.byCity[city] = { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: new Set() };
            }

            details.byProvince[province].persons += per;
            details.byProvince[province].families += fam;
            details.byProvince[province].inside += inFam;
            details.byProvince[province].outside += outFam;
            if (row.ecs_now > 0) details.byProvince[province].ecs++;
            if (row.barangay) {
              details.byProvince[province].brgys.add(row.barangay);
              details.byCity[city].brgys.add(row.barangay);
            }

            details.byCity[city].persons += per;
            details.byCity[city].families += fam;
            details.byCity[city].inside += inFam;
            details.byCity[city].outside += outFam;
            if (row.ecs_now > 0) details.byCity[city].ecs++;

            details.evacStatus.inside += inFam;
            details.evacStatus.outside += outFam;
            details.evacStatus.total += per;

            if (!details.populationByLgu[city]) {
              details.populationByLgu[city] = { families: 0, persons: 0, inFam: 0, inPer: 0, outFam: 0, outPer: 0, ecs: 0 };
            }
            const p = details.populationByLgu[city]
            p.families += fam
            p.persons += per
            p.inFam += inFam
            p.inPer += Number(row.inside_persons_now || 0)
            p.outFam += outFam
            p.outPer += Number(row.outside_persons_now || 0)
            if (row.ecs_now > 0) p.ecs += Number(row.ecs_now)

            addToStats('affectedPopulation', row.barangay, per, report.submitted_at, city)
          })
        })
      } catch (err) {
        console.error('[Dashboard] Error in reportsPromise:', err)
      }
    })()

    // 3. Water Supply - Detailed logs for Infrastructure tab
    const waterPromise = (async () => {
      try {
        const { data } = await api.get('/reports/water_supply_reports', {
          params: { 
            event_id: currentEventId,
            situational_report_id: approvedIdsCsv
          }
        })
        if (!data) return
        data.forEach(row => {
          const isCurrent = row.created_at >= sinceISO
          const type = row.type || 'N/A'
          const brgy = row.barangay || 'N/A';
          const city = row.city || row.mun || toCity(brgy);
          const province = getProvinceForCity(city) || 'Unknown';

          // Hierarchical Filter Scoping
          const isLguUser = user?.account_type === 'LGU' || user?.account_type === 'LGU Admin'
          const isProvincialUser = user?.account_type === 'Provincial' || user?.account_type === 'Provincial Admin' || user?.account_type === 'Provincial Approver'
          
          if (isLguUser && city !== user?.city) return
          if (isProvincialUser && province !== user?.province) return

          // Deduplicate water
          const key = `water-${city}-${brgy}`;
          if (!latestInfra[key] || new Date(row.created_at) > new Date(latestInfra[key].created_at)) {
            latestInfra[key] = { ...row, category: 'water', city, brgy: brgy, province };
          }

          if (isCurrent) {
            byBarangayCategory['waterSupply'] = byBarangayCategory['waterSupply'] || {}
            byBarangayCategory['waterSupply'][type] = (byBarangayCategory['waterSupply'][type] || 0) + 1
            const d = row.created_at.split('T')[0]
            if (dayCounts[d] !== undefined) dayCounts[d] += 1
          }
        })
      } catch (err) {
        console.error('[Dashboard] Error in waterPromise:', err)
      }
    })()

    await Promise.all([...tablePromises, reportsPromise, waterPromise]);

    // After all data is fetched and deduplicated, finalize infrastructure stats
    const defaultProvinceCity = { persons: 0, families: 0, inside: 0, outside: 0, dmg: 0, served: 0, ecs: 0, powerInt: 0, powerRes: 0, roadsNotPassable: 0, roadsPassable: 0, brgys: new Set() };

    Object.values(latestInfra).forEach(row => {
      const { category, city, brgy, province } = row;

      // Ensure province/city entries exist before incrementing counters
      if (!details.byProvince[province]) details.byProvince[province] = { ...defaultProvinceCity, brgys: new Set() };
      if (!details.byCity[city]) details.byCity[city] = { ...defaultProvinceCity, brgys: new Set() };
      
      if (category === 'power') {
        const statusRaw = String(row.status || '').toLowerCase().trim();
        const isRestored = (statusRaw === 'restored') || (!!row.date_restored && statusRaw !== 'ongoing');
        const statusStr = isRestored ? 'restored' : 'interrupted';

        details.infrastructure.push({ 
          name: brgy, 
          city, 
          type: 'power', 
          status: statusStr, 
          restored: row.date_restored,
          provider: row.service_provider,
          created_at: row.created_at
        });
        
        if (isRestored) {
          details.byProvince[province].powerRes++;
          details.byCity[city].powerRes++;
        } else {
          details.byProvince[province].powerInt++;
          details.byCity[city].powerInt++;
        }
      }

      if (category === 'roadsAndBridges') {
        const isNotPassable = row.status?.toLowerCase().includes('not passable');
        const isPassable = !isNotPassable && row.status?.toLowerCase().includes('passable');
        
        details.infrastructure.push({ 
          name: brgy || row.road_bridge_name || row.road_section || row.name, 
          city, 
          type: 'road', 
          class: row.classification, 
          status: isNotPassable ? 'notPassable' : (isPassable ? 'passable' : row.status),
          originalStatus: row.status,
          created_at: row.created_at
        });
        
        if (isNotPassable) {
          details.byProvince[province].roadsNotPassable++;
          details.byCity[city].roadsNotPassable++;
        } else if (isPassable) {
          details.byProvince[province].roadsPassable++;
          details.byCity[city].roadsPassable++;
        }
      }

      if (category === 'communicationLines') {
        const statusRaw = String(row.status_of_communication || '').toLowerCase().trim();
        const isRestored = statusRaw === 'restored' || (!!row.date_restored && statusRaw !== 'ongoing');
        const statusStr = isRestored ? 'restored' : 'interrupted';

        details.infrastructure.push({ type: 'communication', city, loc: brgy, status: statusStr, created_at: row.created_at });
      }

      if (category === 'water') {
        const statusRaw = (row.status || '').toLowerCase().trim();
        const isOperational = (statusRaw === 'restored' || statusRaw === 'operational') || (!!row.date_restored && statusRaw !== 'ongoing');
        details.infrastructure.push({ 
          mun: city, 
          area: brgy, 
          type: 'water', 
          status: isOperational ? 'operational' : 'interrupted', 
          int: row.created_at, 
          res: row.date_restored,
          provider: row.service_provider,
          created_at: row.created_at
        });
      }
    });

    const topCityEntry = Object.entries(totalByCity).sort((a, b) => b[1] - a[1])[0];
    const topCity = topCityEntry ? topCityEntry[0] : null;
    const total = Object.values(totalByCity).reduce((s, n) => s + n, 0);
    const prevTotal = topCity ? (prevTotalByCity[topCity] || 0) : 0;
    const totalTrend = pctChange(total, prevTotal);

    const top4 = topCity ? Object.entries(byCityCategory[topCity] || {})
      .map(([cat, count]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        count,
        pct: (count / (total || 1)) * 100,
        trend: pctChange(count, prevByCityCategory[topCity]?.[cat] || 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4) : [];

    const categoryCards = Object.keys(CATEGORY_LABELS).map(cat => {
      const counts = byBarangayCategory[cat] || {};
      const entries = Object.entries(counts);
      const totalCount = Object.values(counts).reduce((s, n) => s + n, 0);
      const topEntry = [...entries].sort((a, b) => b[1] - a[1])[0];
      const [topBrgy, topCount] = topEntry || ['---', 0];
      const city = topBrgy && topBrgy !== 'N/A' ? toCity(topBrgy) : (topBrgy === 'N/A' ? 'All areas' : '---');

      const barangayData = entries
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));

      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        topBarangay: topBrgy,
        topCount,
        totalCount,
        city,
        detail: topCount > 0 ? `${topCount.toLocaleString()} report${topCount !== 1 ? 's' : ''}` : 'No reports',
        barangayData
      };
    });

    const overviewData = categoryCards
      .filter(c => c.totalCount > 0)
      .map(c => ({ name: c.label, value: c.totalCount }))
      .sort((a, b) => b.value - a.value);

    const trendChartData = Object.entries(dayCounts).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count
    }));

    return { topCity, total, totalTrend, top4, categoryCards, overviewData, trendChartData, details };
  }, [currentEventId, toCity, currentEvent, user, selectedDashboardSitRepId]);

  useEffect(() => {
    // Guard: wait until events have finished loading before fetching dashboard data.
    if (eventsLoading) return

    setError(null)
    let cancelled = false

    // Serve from cache immediately (shows stale data while fresh data loads)
    const cacheKey = currentEventId || 'default'
    if (cacheRef.current[cacheKey]) {
      setResult(cacheRef.current[cacheKey])
      setLoading(false)
      // Still refresh in background so data stays up-to-date
      fetchData().then((data) => {
        if (!cancelled && data) {
          cacheRef.current[cacheKey] = data
          setResult(data)
        }
      }).catch(() => { /* silent background refresh failure */ })
      return () => { cancelled = true }
    }

    setLoading(true)
    fetchData().then((data) => {
      if (!cancelled && data) {
        cacheRef.current[cacheKey] = data
        setResult(data)
      }
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Failed to load dashboard data')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
    // eventsLoading is intentionally excluded from deps to prevent double-fetch.
    // fetchData already depends on currentEventId so that change triggers a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, currentEventId])

  // Real-time Data Subscription for Dashboard
  useEffect(() => {
    if (!socket || !currentEventId || currentEventId === 'default-good-day') return

    console.log(`Setting up Socket.io monitoring for event: ${currentEventId}`)

    // Tables that have an event_id column
    const tablesWithEventId = [
      'related_incidents',
      'roads_and_bridges',
      'power_reports',
      'communication_lines_reports',
      'damaged_houses_reports',
      'class_suspension_reports',
      'work_suspension_reports',
      'declaration_state_of_calamity_reports',
      'pre_emptive_evacuation_reports',
      'assistance_provided_reports',
      'assistance_lgus_agencies_reports',
      'agriculture_damage_reports',
      'infrastructure_damage_reports',
      'water_supply_reports'
    ]

    const handleUpdate = () => {
      console.log('Real-time data update received, refreshing dashboard')
      fetchData().then(data => {
        if (data) {
          const cacheKey = currentEventId || 'default'
          cacheRef.current[cacheKey] = data
          setResult(data)
        }
      })
    }

    // Subscribe to all relevant tables
    tablesWithEventId.forEach(table => {
      socket.on(`${table}:created`, handleUpdate)
      socket.on(`${table}:bulk_created`, handleUpdate)
    })
    
    // Also listen for report_rows
    socket.on('report_rows:created', handleUpdate)

    return () => {
      console.log(`Cleaning up dashboard monitoring for event: ${currentEventId}`)
      tablesWithEventId.forEach(table => {
        socket.off(`${table}:created`, handleUpdate)
        socket.off(`${table}:bulk_created`, handleUpdate)
      })
      socket.off('report_rows:created', handleUpdate)
    }
  }, [currentEventId, fetchData, socket])

  const handleRefresh = () => {
    // Clear cache for current event so we get fresh data
    const cacheKey = currentEventId || 'default'
    delete cacheRef.current[cacheKey]
    setLoading(true)
    setError(null)
    fetchData().then((data) => {
      if (data) {
        cacheRef.current[cacheKey] = data
        setResult(data)
      }
    }).catch((err) => {
      setError(err.message || 'Failed to load dashboard data')
    }).finally(() => setLoading(false))
  }

  const n = result?.categoryCards?.length ?? 0

  useEffect(() => {
    setCurrentStep(0)
    prevStepRef.current = -1
  }, [n])

  // Apply transform and sync center card from current step
  useEffect(() => {
    const track = trackRef.current
    if (!track || n === 0) return
    const justReset = prevStepRef.current === n && currentStep === 0
    prevStepRef.current = currentStep
    if (justReset) {
      track.style.transition = 'none'
      track.style.transform = `translateX(0)`
      const forceReflow = track.offsetHeight
      track.style.transition = ''
    } else {
      track.style.transform = `translateX(${-currentStep * CARD_STEP}px)`
    }
    setCenterCardIndex(currentStep)
  }, [currentStep, n])

  // Advance one card every 3s; seamless loop at N
  useEffect(() => {
    if (n === 0) return
    const track = trackRef.current
    const intervalId = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % (n + 1))
    }, 5000)
    const onTransitionEnd = () => {
      const style = getComputedStyle(track)
      const m = style.transform?.match(/matrix\(([^)]+)\)/)
      const tx = m ? parseFloat(m[1].split(',')[4].trim()) : 0
      const step = Math.round(-tx / CARD_STEP)
      if (step === n) setCurrentStep(0)
    }
    track?.addEventListener('transitionend', onTransitionEnd)
    return () => {
      clearInterval(intervalId)
      track?.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [n])

  // Auto-calculate alert status based on classification inputs
  useEffect(() => {
    if (!showEditEventModal) return;
    const { eventType, classificationValue, intensity, magnitude, depth, ptwcLevel } = editForm;
    let newStatus = editForm.alertStatus;

    if (eventType === 'typhoon') {
      if (classificationValue === 'Super Typhoon') {
        newStatus = 'purple';
      } else if (classificationValue === 'Typhoon') {
        newStatus = 'red';
      } else if (classificationValue === 'Severe Tropical Storm') {
        newStatus = 'orange';
      } else if (classificationValue === 'Tropical Storm') {
        newStatus = 'yellow';
      } else if (classificationValue === 'Tropical Depression') {
        newStatus = 'blue';
      }
    } else if (eventType === 'earthquake') {
      const mag = parseFloat(magnitude) || 0;
      const isShallow = depth === 'Shallow (<70km)';

      if (['VII', 'VIII'].includes(intensity) || mag >= 6.5 || (isShallow && mag >= 6.0)) {
        newStatus = 'red';
      } else if (['V', 'VI'].includes(intensity) || (mag >= 5.0 && mag < 6.5)) {
        newStatus = 'blue';
      } else if (intensity || mag > 0) {
        newStatus = 'white';
      }
    } else if (eventType === 'tsunami') {
      if (['Major', 'Severe'].includes(classificationValue) || ptwcLevel === 'Warning') {
        newStatus = 'red';
      } else if (classificationValue === 'Moderate' || ptwcLevel === 'Watch') {
        newStatus = 'blue';
      } else if (classificationValue === 'Minor' || ptwcLevel === 'Information') {
        newStatus = 'white';
      }
    }

    if (newStatus !== editForm.alertStatus && newStatus) {
      setEditForm(prev => ({ ...prev, alertStatus: newStatus }));
    }
  }, [editForm.eventType, editForm.classificationValue, editForm.intensity, editForm.magnitude, editForm.depth, editForm.ptwcLevel, showEditEventModal]);

  const totalReports = result?.total ?? 0
  const totalTrend = result?.totalTrend ?? 0
  const hasTrend = Number.isFinite(totalTrend)
  const trendData = result?.trendChartData ?? []

  const categoryCards = result?.categoryCards ?? []
  const details = result?.details || {
    sexDistribution: { male: 0, female: 0 },
    evacStatus: { inside: 0, outside: 0, total: 0 },
    byProvince: {},
    infrastructure: [],
    incidents: [],
    suspensions: [],
    preEvacuation: [],
    assistanceByLgu: {},
    damagedHouses: [],
    commLines: [],
    assistance: [] // For legacy or safety
  };
  const totalAll = categoryCards.reduce((s, c) => s + (c.totalCount || 0), 0)

  const toDateTimeLocal = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  }

  const openEditEventModal = (eventToEdit) => {
    const eventData = eventToEdit || currentEvent
    if (eventData) {
      // Extract existing details from summary if editing
      let existingDetails = {
        classificationValue: '',
        magnitude: '',
        intensity: '',
        depth: '',
        windSpeed: '',
        ptwcLevel: ''
      }

      if (eventData.summary) {
        const cMatch = eventData.summary.match(/Classification\*?:\s*(.*)/i);
        const mMatch = eventData.summary.match(/Magnitude\s*\(Mw\)\*?:\s*(.*)/i);
        const iMatch = eventData.summary.match(/Intensity\s*\(PEIS\)\*?:\s*(.*)/i);
        const dMatch = eventData.summary.match(/Depth\*?:\s*(.*)/i);
        const wMatch = eventData.summary.match(/(?:Warning Signal|Signal|Category)\*?:\s*(.*)/i);
        const pMatch = eventData.summary.match(/PTWC Warning Level\*?:\s*(.*)/i);
        const sMatch = eventData.summary.match(/Status\*?:\s*(.*)/i);

        const strip = (str) => str ? str.replace(/[\*_]/g, '').trim() : '';

        if (cMatch) existingDetails.classificationValue = strip(cMatch[1]);
        if (mMatch) existingDetails.magnitude = strip(mMatch[1]);
        if (iMatch) existingDetails.intensity = strip(iMatch[1]);
        if (dMatch) existingDetails.depth = strip(dMatch[1]);
        if (wMatch) existingDetails.windSpeed = strip(wMatch[1]);
        if (pMatch) existingDetails.ptwcLevel = strip(pMatch[1]);
        if (sMatch && !existingDetails.classificationValue) existingDetails.classificationValue = strip(sMatch[1]);
      }

      setIsEditingExistingEvent(true)
      setEditForm({
        name: eventData.name,
        color: eventData.color || '#6366f1',
        startDate: toDateTimeLocal(eventData.startDate),
        endDate: toDateTimeLocal(eventData.endDate),
        eventType: eventData.eventType || 'calamity',
        alertStatus: eventData.alertStatus || 'white',
        pingedReportTypes: eventData.pingedReportTypes || [],
        affectedProvinces: eventData.affectedProvinces || [],
        alertLevel: eventData.alertLevel || '',
        ...existingDetails
      })
      setShowEditEventModal(true)
    }
  }

  const openSelectEventToEdit = () => {
    setSelectedEventIdToEdit('')
    setShowSelectEventToEdit(true)
  }

  const confirmSelectEventToEdit = () => {
    const selectedEvent = events.find(e => e.id === selectedEventIdToEdit)
    if (selectedEvent) {
      setShowSelectEventToEdit(false)
      switchEvent(selectedEvent.id)
    }
  }

  const saveEditEvent = () => {
    const name = (editForm.name || '').trim() || 'Untitled Event'
    const startDate = editForm.startDate ? new Date(editForm.startDate).toISOString() : ''
    const endDate = editForm.endDate ? new Date(editForm.endDate).toISOString() : ''
    const eventType = editForm.eventType || 'calamity'
    const alertStatus = editForm.alertStatus || 'white'
    const pingedReportTypes = editForm.pingedReportTypes || []

    const { classificationValue, windSpeed, magnitude, intensity, depth, ptwcLevel } = editForm;

    let summary = '';

    // Inject dynamic AI classification logic
    if (classificationValue === 'No Threat') {
      summary = `EXECUTIVE SUMMARY

**EVENT ASSESSMENT: NO ACTIVE THREAT**

* **Status**: The monitoring period for this event has been categorized as **No Threat**.
* **Assessment**: No immediate hazards or risks have been identified that require active response or resource deployment at this time.
* **Actions Taken**: Routine monitoring continues. All standby units remain alert but un-deployed.

CHRONOLOGY OF EVENTS`;
    } else if (eventType === 'typhoon') {
      summary = `EXECUTIVE SUMMARY

**TYPHOON / TROPICAL CYCLONE CLASSIFICATION**

* **Category**: ${editForm.alertLevel || 'Monitoring'}
* **Wind Details**: ${windSpeed ? windSpeed + ' km/h' : 'None Assigned'}
* **PAGASA Scale vs Saffir-Simpson Scale**:
* **Tropical Depression**: = 61 km/h (No Saffir-Simpson equivalent)
* **Tropical Storm**: 62 - 88 km/h (No SS equivalent)
* **Severe Tropical Storm**: 89 - 117 km/h (No SS equivalent)
* **Typhoon**: 118 - 184 km/h (SS Category 1-3)
  * *Impact*: Moderate to heavy damage, storm surges potentially 1-3 meters.
* **Super Typhoon**: > 185 km/h (SS Category 4-5)
  * *Impact*: Catastrophic damage, storm surges >3 meters, extreme rainfall.

* **Reference Event**: Super Typhoon Yolanda (Haiyan, 2013) - 315 km/h (Category 5), 5-7m storm surge.
* **Safety Actions**: Evacuate low-lying and coastal areas immediately upon PSWS #3 or higher. Secure structural reinforcements.

CHRONOLOGY OF EVENTS`;
    } else if (eventType === 'earthquake') {
      summary = `EXECUTIVE SUMMARY

**EARTHQUAKE CLASSIFICATION**

* **Magnitude (Mw)**: ${magnitude || 'None'}
* **Intensity (PEIS)**: ${intensity || 'Not Selected'}
* **Depth**: ${depth || 'Unknown'}

* **Moment Magnitude (Mw)**: Measures total energy released.
  * *Minor/Light (Mw < 5.0)*: Generally felt, minimal damage.
  * *Moderate/Strong (Mw 5.0 - 6.9)*: Can cause major damage to poorly constructed buildings.
  * *Major/Great (Mw = 7.0)*: Causes serious widespread damage.
  
* **Modified Mercalli Intensity (MMI) / PEIS**: Measures perceptual impact and damage (I - XII / I - VIII).
  * *PEIS VIII (Very Destructive)*: People find it difficult to stand. Heavy damage to structures.

* **Depth Classification**:
  * *Shallow*: 0-70 km (Most destructive at surface level).
  * *Intermediate*: 70-300 km.
  * *Deep*: 300+ km.

* **Reference Event**: 1990 Luzon Earthquake - Mw 7.7, depth 25km. PEIS VIII.
* **Safety Actions**: Drop, Cover, and Hold On. Evacuate immediately if near coastlines due to tsunami risk. Check structures before re-entry.

CHRONOLOGY OF EVENTS`;
    } else if (eventType === 'tsunami') {
      summary = `EXECUTIVE SUMMARY

**TSUNAMI CLASSIFICATION**

* **Wave Height Reference**:
  * *Minor*: < 1 meter (Can still cause strong localized currents).
  * *Moderate*: 1 - 3 meters (Dangerous to coastal properties and swimmers).
  * *Major*: 3 - 10 meters (Widespread destruction, deep inland inundation).
  * *Severe*: > 10 meters (Catastrophic regional impact).

* **PTWC Warning Levels**:
  * *Information**: Earthquake occurred, evaluating tsunami risk.
  * *Watch*: Danger level not yet known, stay alert.
  * *Warning*: Flooding imminent or occurring.

* **Reference Event**: 1976 Moro Gulf Tsunami - Wave heights up to 9 meters following Mw 8.0 quake.
* **Safety Actions**: Move inland to higher ground immediately. Do NOT wait for official warnings if strong shaking is felt near the coast (Natural Warning).

CHRONOLOGY OF EVENTS`;
    }

    // Inject the selected Alert Level / Warning Signal into the summary if present
    if (editForm.alertLevel) {
      const typeLevels = ALERT_LEVELS[eventType] || ALERT_LEVELS.calamity;
      const levelObj = typeLevels.find(l => l.value === editForm.alertLevel);
      if (levelObj && levelObj.value) {
        const labelText = eventType === 'typhoon' ? 'Current Category' : 'Current Alert/Signal';
        const levelHeader = `\n* **${labelText}**: ${levelObj.label}\n`;
        // Insert after the main classification header
        summary = summary.replace(/(\*\*.*CLASSIFICATION\*\*)/i, `$1${levelHeader}`);
      }
    }

    if (isEditingExistingEvent) {
      const targetId = currentEvent ? currentEvent.id : null
      if (targetId) {
        // If there was an existing summary, try to preserve the chronology
        let finalSummary = summary;
        if (currentEvent?.summary && summary) {
          const oldParts = currentEvent.summary.split(/CHRONOLOGY OF EVENTS(?::)?/i);
          if (oldParts.length > 1 && oldParts[1].trim()) {
            finalSummary = summary + oldParts[1];
          }
        } else if (!summary) {
          // If no new summary was generated (e.g. classification was empty), keep old one
          finalSummary = currentEvent?.summary;
        }

        updateEvent(targetId, {
          name,
          color: editForm.color,
          startDate,
          endDate,
          eventType,
          alertStatus,
          alertLevel: editForm.alertLevel || '',
          pingedReportTypes,
          affectedProvinces: editForm.affectedProvinces || [],
          summary: finalSummary
        })
      }
    } else {
      // Creating new event
      addEvent({ name, color: editForm.color, startDate, endDate, eventType, alertStatus, alertLevel: editForm.alertLevel || '', pingedReportTypes, affectedProvinces: editForm.affectedProvinces || [], summary })
    }
    setShowEditEventModal(false)
  }

  const confirmDeleteEvent = () => {
    if (currentEvent) {
      deleteEvent(currentEvent.id)
      setShowDeleteConfirm(false)
      setShowEditEventModal(false)
    }
  }

  const formatEventDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' })
  }




  // Get background gradient based on alert status
  // No longer using inline background gradient, using CSS variables on layout
  const getBackgroundGradient = () => 'transparent'

  const renderCategoryView = (card) => {
    const hasData = card.barangayData.length > 0;
    const CHART_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#ef4444'];
    const usePie = ['affectedPopulation', 'relatedIncidents', 'damagedHouses'].includes(card.category);

    return (
      <div key={card.category} className="viz-content-wrapper-modular" style={{ marginBottom: '2.5rem' }}>
        {/* Category Top Grid */}
        <div className="metrics-row">
          <div className="kpi-card-premium blue">
            <div className="kpi-label-premium">Impact Level</div>
            <div className="kpi-value-premium">{card.totalCount.toLocaleString()}</div>
            <div className="kpi-sub-premium">Total records recorded</div>
          </div>

          <div className="kpi-card-premium purple">
            <div className="kpi-label-premium">Primary Area</div>
            <div className="kpi-value-premium" style={{ fontSize: '18px' }}>{card.topBarangay}</div>
            <div className="kpi-sub-premium">Highest concentration</div>
          </div>

          <div className="kpi-card-premium teal">
            <div className="kpi-label-premium">Impact Share</div>
            <div className="kpi-value-premium">{totalAll > 0 ? Math.round((card.totalCount / totalAll) * 100) : 0}%</div>
            <div className="kpi-sub-premium">Contribution to total</div>
          </div>

          <div className="kpi-card-premium orange">
            <div className="kpi-label-premium">Coverage</div>
            <div className="kpi-value-premium">{card.barangayData.length}</div>
            <div className="kpi-sub-premium">Reporting localities</div>
          </div>
        </div>

        <div className="premium-card" style={{ marginTop: '1.5rem' }}>
          <div className="premium-card-header">
            <div className="premium-card-title">{card.label} Distribution</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem' }}>
            <div style={{ minHeight: '400px', background: 'var(--bg-page)', borderRadius: '12px', padding: '1.5rem' }}>
              {hasData ? (
                <ResponsiveContainer width="100%" height={usePie ? 400 : Math.max(400, card.barangayData.length * 35)}>
                  {usePie ? (
                    <PieChart>
                      <Pie
                        data={card.barangayData}
                        innerRadius={80}
                        outerRadius={130}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {card.barangayData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : (
                    <BarChart
                      data={card.barangayData}
                      layout="vertical"
                      margin={{ left: 100, right: 30 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                        width={100}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip cursor={{ fill: 'rgba(99,102,241,0.03)' }} />
                      <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      >
                        {card.barangayData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <BarChartIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.875rem' }}>No geographic data available for this category</p>
                </div>
              )}
            </div>

            <div className="sidebar-rankings">
              <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendUp size={14} /> Top Breakdown
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Locality</th>
                      <th style={{ textAlign: 'left' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.barangayData.slice(0, 15).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>{item.name}</td>
                        <td style={{ textAlign: 'left', fontWeight: 700, fontFamily: 'DM Mono', fontSize: '0.8125rem', color: 'var(--text-main)' }}>{item.value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-page)', borderRadius: '10px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Analytic Insight</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', margin: '4px 0 0', lineHeight: 1.4 }}>
                  {hasData
                    ? `${card.topBarangay} represents ${((card.topCount / (card.totalCount || 1)) * 100).toFixed(1)}% of all ${card.label} reports for this event.`
                    : 'Not enough data points to generate meaningful geographic insights.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="page dashboard-page" style={{ background: getBackgroundGradient() }}>
        {/* Top Header */}
        <header className="dash-header">
          <div className="dash-header-left">
            <h1 className="dash-header-title">
              Dashboard
              {!isRegionalUser && (
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '12px', background: 'var(--bg-page)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  {isLguUser ? `Local Unit: ${user?.city}` : `Province: ${user?.province}`}
                </span>
              )}
            </h1>
          </div>
          <div className="dashboard-header-right">
            <NotificationBell onNotificationClick={handleNotificationClick} />
          </div>
        </header>

        {/* Hero Section */}
        <section className="dash-hero">
          <div className={`dash-hero-icon alert-status-${currentEvent?.alertStatus || 'white'} ${
            !userSignal ? (
              currentEvent?.alertStatus === 'red' ? 'dash-hero-icon-alarm-red' :
              currentEvent?.alertStatus === 'blue' ? 'dash-hero-icon-alarm-blue' :
              currentEvent?.alertStatus === 'white' ? 'dash-hero-icon-alarm-white' : ''
            ) : ''
          }`} style={{
            background: userSignal === '1' ? '#fde047' : 
                        userSignal === '2' ? '#fdba74' : 
                        userSignal === '3' ? '#fca5a5' : 
                        userSignal === '4' ? '#f9a8d4' : 
                        userSignal === '5' ? '#d8b4fe' : 
                        (currentEvent?.alertStatus === 'red' ? '#ef4444' :
                        currentEvent?.alertStatus === 'blue' ? '#3b82f6' :
                        '#ffffff'),
            color: (!userSignal && (currentEvent?.alertStatus === 'red' || currentEvent?.alertStatus === 'blue')) ? '#ffffff' : '#1e293b',
            border: (!userSignal && currentEvent?.alertStatus === 'white') ? '1px solid #e2e8f0' : undefined
          }}>
            {userSignal ? (
              <span style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b' }}>{userSignal}</span>
            ) : (
              EVENT_TYPE_ICONS[currentEvent?.eventType] || <WarningCircle size={32} weight="duotone" />
            )}
          </div>

          <div className="dash-hero-title-wrap">
            <h2 className="dash-hero-amount">
              {currentEvent ? currentEvent.name : 'Clear Skies (No Active Event)'}
            </h2>
            {userSignal && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>
                Signal <strong style={{ color: SIGNAL_COLORS[userSignal].text }}>{userSignal}</strong> assigned to your area
              </p>
            )}
          </div>

          <div className={`dash-hero-meta alert-status-${currentEvent?.alertStatus || 'white'}`}>
            {currentEvent && currentEvent.id !== 'default-good-day' && currentEvent.alertStatus && (
              <div className="meta-item">
                <span style={{
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  background: currentEvent.alertStatus === 'red' ? '#ef4444' : currentEvent.alertStatus === 'blue' ? '#3b82f6' : '#94a3b8',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.8)',
                    flexShrink: 0
                  }} />
                  {currentEvent.alertStatus === 'red' ? 'Red' : currentEvent.alertStatus === 'blue' ? 'Blue' : 'White'}
                </span>
              </div>
            )}

            <div className="meta-item">
              <div className="meta-icon"><Warning size={18} /></div>
              <div className="meta-content">
                <span className="meta-label">Type</span>
                <span className="meta-value" style={{ textTransform: 'capitalize' }}>
                  {currentEvent?.eventType === 'typhoon' ? 'Tropical Cyclone' : (currentEvent?.eventType || 'Operational')}
                </span>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"><Info size={18} /></div>
              <div className="meta-content">
                <span className="meta-label">
                  {userSignal ? 'My Signal' : (currentEvent?.eventType === 'earthquake' ? 'Magnitude' : 'Category')}
                </span>
                <span className="meta-value" style={{ whiteSpace: 'nowrap' }}>
                  {userSignal 
                    ? `Public Warning Signal ${userSignal}` 
                    : (currentEvent?.eventType === 'earthquake' && currentEvent?.alertLevel?.startsWith('Magnitude ')
                        ? currentEvent.alertLevel.replace('Magnitude ', '') 
                        : (currentEvent?.alertLevel || 'No Alert'))
                  }
                </span>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"><Calendar size={18} /></div>
              <div className="meta-content">
                <span className="meta-label">Date</span>
                <span className="meta-value">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Draggable Tab Navigation and Filters */}
        <div className="tabs-nav-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            className="card-tabs-container"
            style={{ flex: 1 }}
            ref={tabsRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            <div className="card-tabs">
              {['Overview', 'Agriculture', 'Incidents', 'Infrastructure', 'Assistance', 'Suspension', 'Pre-Evacuation'].map((tab) => {
                const isActive = activeTab === tab || (tab === 'Overview' && activeTab === 'All Reports');
                return (
                  <button
                    key={tab}
                    className={`card-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderLeft: '1px solid var(--border-color)', flexShrink: 0 }}>

            {/* Event Custom Dropdown */}
            <div className="dash-custom-dropdown" ref={eventDropdownRef} style={{ position: 'relative' }}>
              <button
                className={`dash-dropdown-trigger ${eventDropdownOpen ? 'open' : ''}`}
                onClick={() => { setEventDropdownOpen(v => !v); setSitRepDropdownOpen(false); }}
              >
                <span className="dash-dropdown-label">
                  <span className="dash-dropdown-prefix">Event</span>
                  <span className="dash-dropdown-value">{events.find(e => e.id === currentEventId)?.name || 'Select Event'}</span>
                </span>
                <CaretRight className={`dash-dropdown-caret ${eventDropdownOpen ? 'rotated' : ''}`} size={12} weight="bold" />
              </button>
              {eventDropdownOpen && (
                <div className="dash-dropdown-menu">
                  {events.map(e => (
                    <button
                      key={e.id}
                      className={`dash-dropdown-item ${e.id === currentEventId ? 'active' : ''}`}
                      onClick={() => { switchEvent(e.id); setSelectedDashboardSitRepId(''); setEventDropdownOpen(false); }}
                    >
                      <span className="dash-dropdown-item-dot" />
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SitRep Custom Dropdown */}
            {(() => {
              const approvedSitReps = (result?.details?.sitRepStatus || [])
                .filter(sr => sr.status === 'Approved')
                .filter(sr => isProvincialUser && user?.province ? sr.province === user.province : true)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              const selectedSr = approvedSitReps.find(sr => sr.id === selectedDashboardSitRepId);
              return (
                <div className="dash-custom-dropdown" ref={sitRepDropdownRef} style={{ position: 'relative' }}>
                  <button
                    className={`dash-dropdown-trigger ${sitRepDropdownOpen ? 'open' : ''}`}
                    onClick={() => { setSitRepDropdownOpen(v => !v); setEventDropdownOpen(false); }}
                  >
                    <span className="dash-dropdown-label">
                      <span className="dash-dropdown-prefix">SitRep</span>
                      <span className="dash-dropdown-value">{selectedSr ? selectedSr.title : 'Latest Approved'}</span>
                    </span>
                    <CaretRight className={`dash-dropdown-caret ${sitRepDropdownOpen ? 'rotated' : ''}`} size={12} weight="bold" />
                  </button>
                  {sitRepDropdownOpen && (
                    <div className="dash-dropdown-menu" style={{ right: 0, left: 'auto', minWidth: '240px' }}>
                      <button
                        className={`dash-dropdown-item ${!selectedDashboardSitRepId ? 'active' : ''}`}
                        onClick={() => { setSelectedDashboardSitRepId(''); setSitRepDropdownOpen(false); }}
                      >
                        <span className="dash-dropdown-item-dot" />
                        Latest Approved (All)
                      </button>
                      {approvedSitReps.map(sr => (
                        <button
                          key={sr.id}
                          className={`dash-dropdown-item ${sr.id === selectedDashboardSitRepId ? 'active' : ''}`}
                          onClick={() => { setSelectedDashboardSitRepId(sr.id); setSitRepDropdownOpen(false); }}
                        >
                          <span className="dash-dropdown-item-dot" />
                          <span>
                            <div style={{ fontWeight: 600, fontSize: '12px' }}>{sr.title}</div>
                            <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '1px' }}>{sr.province}</div>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Back Button */}
            <button
              className="dash-back-btn"
              onClick={() => {
                const latestDeployed = events.find(e => e.isDeployed) || events[0];
                if (latestDeployed) switchEvent(latestDeployed.id);
                setSelectedDashboardSitRepId('');
                setEventDropdownOpen(false);
                setSitRepDropdownOpen(false);
              }}
              title="Reset to latest deployed event"
            >
              <CaretLeft size={13} weight="bold" />
              Back
            </button>
          </div>
        </div>

        {/* Main Content Area: Modular Responsive Dashboard */}
        <div className="dash-main-card">
          {loading && !result ? (
            <div style={{ padding: '4rem', textAlign: 'left' }}>
              <LoadingSpinner label="Preparing summary dashboard..." />
            </div>
          ) : error && !result ? (
            <div className="dashboard-conversion-card" style={{ color: '#dc2626', margin: '2rem' }}>
              {error}
            </div>
          ) : (
            <>
              {(activeTab === 'Overview' || activeTab === 'All Reports') ? (
                <div className="modular-dashboard">
                  {/* No Approved Data Warning */}
                  {result?.total === 0 && currentEventId !== 'default-good-day' && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '12px',
                        padding: '2rem 1.5rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ 
                          background: 'rgba(245, 158, 11, 0.1)', 
                          padding: '0.75rem', 
                          borderRadius: '50%', 
                          marginBottom: '1rem' 
                        }}>
                          <Warning size={28} color="#d97706" style={{ display: 'block', opacity: 0.9 }} />
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#92400e', marginBottom: '0.5rem' }}>No Approved Reports Available</h3>
                        <p style={{ fontSize: '0.875rem', color: '#b45309', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5, opacity: 0.9 }}>
                          The dashboard is strictly displaying data from <strong>Approved</strong> situational reports.
                          If you have submitted data, please ensure the corresponding Situational Report is approved by a Regional Admin to see it here.
                        </p>
                      </div>
                  )}
                  {/* State of Calamity Alert Banner */}
                  {details.suspensions.some(s => s.type === 'stateOfCalamity') && (
                    <div style={{ background: "linear-gradient(135deg,rgba(244,63,94,0.1),rgba(244,63,94,0.03))", border: `1px solid rgba(244,63,94,0.3)`, borderLeft: `3px solid ${T.rose}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                      <span style={{ fontSize: 26 }}>??</span>
                      <div>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13, color: T.rose, letterSpacing: "2px", textTransform: "uppercase" }}>State of Calamity Declared</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          Multiple LGUs have officially declared a state of calamity. Expedited procurement and calamity fund access are active.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Row: 6-column KPI Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 18 }}>
                    <div className="kpi-card-premium blue" onClick={() => setShowAffectedPersonsModal(true)} style={{ cursor: 'pointer' }}>
                    <div className="kpi-label-premium">Affected Persons</div>
                    <div className="kpi-value-premium">{(categoryCards.find(c => c.category === 'affectedPopulation')?.totalCount || 0).toLocaleString()}</div>
                    <div className="kpi-sub-premium">Total lives impacted</div>
                  </div>

                    <div className="kpi-card-premium orange" onClick={() => setActiveTab('Pre-Evacuation')} style={{ cursor: 'pointer' }}>
                      <div className="kpi-label-premium">Currently Evacuated</div>
                      <div className="kpi-value-premium">{((result?.details?.evacStatus?.inside || 0) + (result?.details?.evacStatus?.outside || 0)).toLocaleString()}</div>
                      <div className="kpi-sub-premium">In ECs & with relatives</div>
                    </div>

                    <div className="kpi-card-premium amber" onClick={() => setActiveTab('Pre-Evacuation')} style={{ cursor: 'pointer' }}>
                      <div className="kpi-label-premium">Damaged Houses</div>
                      <div className="kpi-value-premium">{(categoryCards.find(c => c.category === 'damagedHouses')?.totalCount || 0).toLocaleString()}</div>
                      <div className="kpi-sub-premium">Totally & partially impacted</div>
                    </div>

                    <div className="kpi-card-premium blue" onClick={() => setActiveTab('Infrastructure')} style={{ cursor: 'pointer', borderTopColor: T.indigo }}>
                      <div className="kpi-label-premium">Power Still Out</div>
                      <div className="kpi-value-premium">{details.infrastructure.filter(i => i.type === 'power' && i.status === 'interrupted').length}</div>
                      <div className="kpi-sub-premium">Areas without restoration</div>
                    </div>

                    <div className="kpi-card-premium slate" onClick={() => setActiveTab('Infrastructure')} style={{ cursor: 'pointer' }}>
                      <div className="kpi-label-premium">Roads Not Passable</div>
                      <div className="kpi-value-premium">{details.infrastructure.filter(i => i.type === 'road' && i.status === 'notPassable').length}</div>
                      <div className="kpi-sub-premium">Obstructions reported</div>
                    </div>

                    <div className="kpi-card-premium teal" onClick={() => setActiveTab('Assistance')} style={{ cursor: 'pointer' }}>
                      <div className="kpi-label-premium">Assistance Value</div>
                      <div className="kpi-value-premium">₱ {(() => {
                        const val = Object.values(details.assistanceByLgu || {}).reduce((s, v) => s + v, 0);
                        return val >= 1000 ? `${(val / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K` : val.toLocaleString();
                      })()}</div>
                      <div className="kpi-sub-premium">Total funds disbursed</div>
                    </div>
                  </div>

                  {/* Middle Row: 2-col Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, marginTop: 20 }}>
                    {/* Event Summary placeholder removed */}

                    {/* Affected Persons by City Bar Chart */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Affected Persons</div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '4px' }}>BY CITY</span>
                      </div>
                      <div style={{ height: '240px' }}>
                        {Object.keys(result?.details?.byCity || {}).length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(result.details.byCity).sort((a, b) => b[1].persons - a[1].persons).slice(0, 4).map(([name, data]) => ({ name, persons: data.persons }))} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={0} />
                              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                              <Bar dataKey="persons" radius={[4, 4, 0, 0]}>
                                {Object.entries(result.details.byCity).slice(0, 4).map((_, i) => (
                                  <Cell key={i} fill={[T.indigo, T.rose, T.amber, T.indigo, T.teal][i % 5]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>No geographic data available</div>
                        )}
                      </div>
                    </div>

                    {/* Evacuation Status Pie Chart */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Evacuation Status</div>
                        <span style={{ fontSize: '10px', color: T.teal, background: 'rgba(0,201,160,0.1)', padding: '2px 8px', borderRadius: '4px' }}>CURRENT</span>
                      </div>
                      <div style={{ height: '200px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Inside ECs', value: result?.details?.evacStatus?.inside || 0, color: T.indigo },
                                { name: 'Outside ECs', value: result?.details?.evacStatus?.outside || 0, color: T.amber },
                                { name: 'Not Sheltered', value: Math.max(0, (result?.details?.evacStatus?.total || 0) - (result?.details?.evacStatus?.inside || 0) - (result?.details?.evacStatus?.outside || 0)), color: T.slate }
                              ]}
                              cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value"
                            >
                              {[T.indigo, T.amber, T.slate].map((color, i) => <Cell key={i} fill={color} stroke="none" />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {[
                        { label: 'Inside ECs', value: result?.details?.evacStatus?.inside || 0, color: T.indigo },
                        { label: 'Outside ECs', value: result?.details?.evacStatus?.outside || 0, color: T.amber },
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-muted)', flex: 1 }}>{item.label}</span>
                          <span style={{ fontWeight: 700, fontFamily: 'DM Mono' }}>{item.value.toLocaleString()}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Active ECs</span>
                          <span style={{ fontWeight: 700, color: T.teal }}>{Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.ecs, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Provincial SitRep Status Table (Regional Only) */}
                  {isRegionalUser && (
                    <div className="premium-card" style={{ marginBottom: 14 }}>
                      <div className="premium-card-header">
                        <div className="premium-card-title">Provincial SitRep Status</div>
                        <span style={{ fontSize: '10px', color: T.blue, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>LATEST UPDATES</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Province</th>
                              <th>Latest SitRep Title</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'left' }}>Submission Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PROVINCE_NAMES.map(province => {
                              const latestSr = (result?.details?.sitRepStatus || [])
                                .filter(sr => sr.province === province)
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                              
                              return (
                                <tr key={province} className="trow">
                                  <td style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px' }}>{province.toUpperCase()}</td>
                                  <td>{latestSr ? latestSr.title : <span style={{ color: '#94a3b8' }}>No Submission</span>}</td>
                                  <td>
                                    {latestSr ? (
                                      <span style={{
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        background: latestSr.status === 'Approved' ? 'rgba(0,201,160,0.1)' : 'rgba(249,115,22,0.1)',
                                        color: latestSr.status === 'Approved' ? T.teal : T.orange,
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                      }}>
                                        {latestSr.status.toUpperCase()}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                                    {latestSr ? new Date(latestSr.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recent SitRep Submissions (Regional Only) */}
                  {isRegionalUser && (
                    <div className="premium-card" style={{ marginBottom: 14 }}>
                      <div className="premium-card-header">
                        <div className="premium-card-title">Recent Situational Reports</div>
                        <span style={{ fontSize: '10px', color: T.blue, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>ALL SUBMISSIONS</span>
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Report Title</th>
                              <th>Province</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'left' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(result?.details?.sitRepStatus || []).length > 0 ? (
                              [...result.details.sitRepStatus]
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .slice(0, 10)
                                .map((sr, i) => (
                                  <tr key={i} className="trow">
                                    <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '12px' }}>{sr.title}</td>
                                    <td>{sr.province}</td>
                                    <td>
                                      <span style={{
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        background: sr.status === 'Approved' ? 'rgba(0,201,160,0.1)' : 'rgba(249,115,22,0.1)',
                                        color: sr.status === 'Approved' ? T.teal : T.orange,
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                      }}>
                                        {(sr.status || 'Draft').toUpperCase()}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
                                      {new Date(sr.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                  </tr>
                                ))
                            ) : (
                              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No situational reports found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Provincial Data Summary Table (Regional Only) */}
                  {isRegionalUser && (
                    <div className="premium-card" style={{ marginBottom: 14 }}>
                      <div className="premium-card-header">
                        <div className="premium-card-title">Provincial Data Summary</div>
                        <span style={{ fontSize: '10px', color: T.teal, background: 'rgba(20,184,166,0.1)', padding: '2px 8px', borderRadius: '4px' }}>CONSOLIDATED</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Province</th>
                              <th style={{ textAlign: 'left' }}>Families</th>
                              <th style={{ textAlign: 'left' }}>Persons</th>
                              <th style={{ textAlign: 'left' }}>In ECs</th>
                              <th style={{ textAlign: 'left' }}>Out ECs</th>
                              <th style={{ textAlign: 'left' }}>Total Served</th>
                              <th style={{ textAlign: 'left' }}>Active ECs</th>
                              <th style={{ textAlign: 'left' }}>Dmg Houses</th>
                              <th style={{ textAlign: 'left' }}>Power Out</th>
                              <th style={{ textAlign: 'left' }}>Roads Blocked</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(result?.details?.byProvince || {}).length > 0 ? (
                              Object.entries(result.details.byProvince).map(([province, stats], i) => (
                                <tr key={province} className="trow">
                                  <td style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px' }}>{province.toUpperCase()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.families.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 700 }}>{stats.persons.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.inside.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.outside.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', color: T.teal, fontWeight: 700 }}>{stats.served.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.ecs}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.dmg.toLocaleString()}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', color: stats.powerInt > 0 ? T.rose : 'inherit' }}>{stats.powerInt}</td>
                                  <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', color: stats.roadsNotPassable > 0 ? T.rose : 'inherit' }}>{stats.roadsNotPassable}</td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan="10" style={{ textAlign: 'left', color: '#94a3b8', padding: '2rem' }}>No provincial data available</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bottom Table: City/Municipality Summary */}
                  <div className="premium-card">
                    <div className="premium-card-header">
                      <div className="premium-card-title">City/Municipality Summary</div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '4px' }}>ALL AREAS</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th>Municipality</th>
                            <th style={{ textAlign: 'left' }}>Brgys</th>
                            <th style={{ textAlign: 'left' }}>Families</th>
                            <th style={{ textAlign: 'left' }}>Persons</th>
                            <th style={{ textAlign: 'left' }}>In ECs</th>
                            <th style={{ textAlign: 'left' }}>Out ECs</th>
                            <th style={{ textAlign: 'left' }}>Total Served</th>
                            <th style={{ textAlign: 'left' }}>Active ECs</th>
                            <th style={{ textAlign: 'left' }}>Dmg Houses</th>
                            <th style={{ textAlign: 'left' }}>Calamity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(result?.details?.byCity || {}).length > 0 ? (
                            Object.entries(result.details.byCity).map(([city, stats], i) => (
                              <tr key={city} className="trow">
                                <td>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px' }}>{city.toUpperCase()}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{getProvinceForCity(city)}</div>
                                </td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.brgys?.size || 0}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.families.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 700, color: stats.persons > 100000 ? T.rose : stats.persons > 10000 ? T.amber : 'var(--text-main)' }}>{stats.persons.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.inside.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.outside.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', color: T.teal, fontWeight: 700 }}>{stats.served.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px' }}>{stats.ecs}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontSize: '11px', color: stats.dmg > 0 ? T.amber : 'var(--text-muted)' }}>{stats.dmg > 0 ? stats.dmg.toLocaleString() : '—'}</td>
                                <td style={{ textAlign: 'left' }}>
                                  {details.suspensions.find(s => s.city === city && s.type === 'stateOfCalamity') ? (
                                    <span style={{ fontSize: '9px', fontWeight: 800, background: 'rgba(240,69,69,0.1)', color: T.rose, padding: '2px 6px', borderRadius: '4px' }}>DECLARED</span>
                                  ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="10" style={{ textAlign: 'left', color: '#94a3b8', padding: '2rem' }}>No municipality data aggregated yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Agriculture' ? (
                <div className="category-viz-container">
                  {/* KPI Row for Agriculture */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
                    <div className="kpi-card-premium amber">
                      <div className="kpi-label-premium">Total Production Loss</div>
                      <div className="kpi-value-premium">₱ {Object.values(details.agriByCity).reduce((s, v) => s + v, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="kpi-sub-premium">Estimated value in PHP</div>
                    </div>
                    <div className="kpi-card-premium blue">
                      <div className="kpi-label-premium">Affected Farmers/Fisherfolk</div>
                      <div className="kpi-value-premium">{categoryCards.find(c => c.category === 'agricultureDamage')?.totalCount.toLocaleString() || 0}</div>
                      <div className="kpi-sub-premium">Total individuals recorded</div>
                    </div>
                    <div className="kpi-card-premium teal">
                      <div className="kpi-label-premium">Reporting LGUs</div>
                      <div className="kpi-value-premium">{Object.keys(details.agriByCity).length}</div>
                      <div className="kpi-sub-premium">Active data points</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Loss Value by Municipality</div>
                      </div>
                      <div style={{ height: '300px' }}>
                        {Object.keys(details.agriByCity).length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={Object.entries(details.agriByCity).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value) => `₱ ${value.toLocaleString()}`} />
                              <Bar dataKey="value" fill={T.amber} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="notification-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data available</div>
                        )}
                      </div>
                    </div>

                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Loss by Classification</div>
                      </div>
                      <div style={{ height: '260px' }}>
                        {Object.keys(details.agriByClass).length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(details.agriByClass).map(([name, value]) => ({ name, value }))}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                              >
                                {Object.entries(details.agriByClass).map((_, i) => (
                                  <Cell key={i} fill={[T.teal, T.amber, T.indigo, T.rose, T.orange][i % 5]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => `₱ ${value.toLocaleString()}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="notification-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data available</div>
                        )}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {Object.entries(details.agriByClass).map(([cls, val], i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 4 }}>
                            <span style={{ color: '#64748b' }}>{cls}</span>
                            <span style={{ fontWeight: 700 }}>₱ {val.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Incidents' ? (
                <div className="category-viz-container">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    {/* Incident Distribution by City */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Incidents by City</div>
                        <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>TOP 4 AREAS</span>
                      </div>
                      <div style={{ height: '240px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={Object.entries(
                              details.incidents.reduce((acc, curr) => {
                                acc[curr.city] = (acc[curr.city] || 0) + 1;
                                return acc;
                              }, {})
                            )
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 4)
                              .map(([name, value]) => ({ name, value }))}
                            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {[T.indigo, T.rose, T.amber, T.teal].map((color, i) => (
                                <Cell key={`cell-${i}`} fill={color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Incident Type Distribution */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Incident Types</div>
                        <span style={{ fontSize: '10px', color: T.blue, background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '4px' }}>BREAKDOWN</span>
                      </div>
                      <div style={{ height: '220px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(
                                details.incidents.reduce((acc, curr) => {
                                  acc[curr.type] = (acc[curr.type] || 0) + 1;
                                  return acc;
                                }, {})
                              )
                                .map(([name, value]) => ({ name, value }))}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value"
                            >
                              {[T.indigo, T.purple, T.rose, T.amber, T.teal, T.blue, T.orange].map((color, i) => (
                                <Cell key={`cell-${i}`} fill={color} stroke="none" />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {Object.entries(
                          details.incidents.reduce((acc, curr) => {
                            acc[curr.type] = (acc[curr.type] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([type, count], i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: [T.indigo, T.purple, T.rose, T.amber, T.teal, T.blue, T.orange][i % 7], flexShrink: 0 }} />
                              <span style={{ color: '#64748b' }}>{type}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: 'DM Mono' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Incident Log */}
                  <div className="premium-card">
                    <div className="premium-card-header">
                      <div className="premium-card-title">Recent Incident Reports</div>
                      <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>LATEST FIRST</span>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th>Incident Type</th>
                            <th>Barangay / Location</th>
                            <th>Municipality</th>
                            {isRegionalUser && (
                              <th>Province</th>
                            )}
                            <th>Status</th>
                            <th>Occurred</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.incidents.length > 0 ? (
                            [...details.incidents].reverse().map((inc, i) => (
                              <tr key={i} className="trow">
                                <td>
                                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '12px' }}>{inc.type}</div>
                                </td>
                                <td style={{ fontSize: '11px' }}>{inc.loc}</td>
                                <td style={{ fontSize: '11px' }}>{inc.city}</td>
                                {isRegionalUser && (
                                  <td style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                                    {getProvinceForCity(inc.city) || '-'}
                                  </td>
                                )}
                                <td>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    background: inc.status?.toLowerCase() === 'ongoing' ? 'rgba(249,115,22,0.15)' : 'rgba(20,184,166,0.15)',
                                    color: inc.status?.toLowerCase() === 'ongoing' ? T.orange : T.teal,
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                  }}>
                                    {inc.status?.toUpperCase() || 'REPORTED'}
                                  </span>
                                </td>
                                <td style={{ fontSize: '10px', color: '#64748b', fontFamily: 'DM Mono' }}>
                                  {inc.date ? new Date(inc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="5" style={{ textAlign: 'left', color: '#94a3b8', padding: '3rem' }}>No incident records available</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Infrastructure' ? (
                <div className="category-viz-container">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    {/* Power Grid Status */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Power Supply Status</div>
                        <span style={{ fontSize: '10px', color: T.rose, background: 'rgba(244,63,94,0.15)', padding: '2px 8px', borderRadius: '4px' }}>UTILITY IMPACT</span>
                      </div>
                      <div style={{ height: '260px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(result?.details?.byCity || {}).sort((a, b) => (b[1].powerInt + b[1].powerRes) - (a[1].powerInt + a[1].powerRes)).slice(0, 8).map(([name, stats]) => ({ name, int: stats.powerInt, res: stats.powerRes }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} verticalAlign="bottom" height={36} />
                            <Bar dataKey="int" name="Interrupted" fill={T.rose} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="res" name="Restored" fill={T.teal} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 14 }}>
                        {Object.entries(result?.details?.byCity || {}).sort((a, b) => (b[1].powerInt + b[1].powerRes) - (a[1].powerInt + a[1].powerRes)).slice(0, 8).map(([city, stats], idx) => {
                          const total = stats.powerInt + stats.powerRes;
                          const pct = total === 0 ? 0 : Math.round((stats.powerRes / total) * 100);
                          return (
                            <div key={idx} style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700 }}>{city}</span>
                                <span style={{ fontSize: '9px', fontWeight: 600, color: T.teal }}>{pct}%</span>
                              </div>
                              <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: T.teal }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Roads & Bridges Status */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Roads & Bridges Passability</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderTop: `2px solid ${T.rose}`, borderRadius: 10, padding: 10, textAlign: 'left' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: T.rose }}>{Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.roadsNotPassable, 0)}</div>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#b91c1c' }}>NOT PASSABLE</div>
                        </div>
                        <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderTop: `2px solid ${T.teal}`, borderRadius: 10, padding: 10, textAlign: 'left' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: T.teal }}>{Object.values(result?.details?.byCity || {}).reduce((s, p) => s + (p.roadsPassable || 0), 0)}</div>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#15803d' }}>NOW PASSABLE</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: `2px solid #64748b`, borderRadius: 10, padding: 10, textAlign: 'left' }}>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>0</div>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#475569' }}>BRIDGES</div>
                        </div>
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table className="premium-table">
                          <thead><tr><th>Classification</th><th style={{ textAlign: 'left' }}>Not Passable</th><th style={{ textAlign: 'left' }}>Passable</th></tr></thead>
                          <tbody>
                            {[
                              { name: 'National (Primary)', np: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Primary' && r.status === 'notPassable').length || 0, p: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Primary' && r.status === 'passable').length || 0 },
                              { name: 'National (Secondary)', np: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Secondary' && r.status === 'notPassable').length || 0, p: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Secondary' && r.status === 'passable').length || 0 },
                              { name: 'Provincial', np: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Provincial' && r.status === 'notPassable').length || 0, p: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'Provincial' && r.status === 'passable').length || 0 },
                              { name: 'City/Muni', np: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'City' && r.status === 'notPassable').length || 0, p: details?.infrastructure?.filter(r => r.type === 'road' && r.class === 'City' && r.status === 'passable').length || 0 }
                            ].map((row, i) => (
                              <tr key={i}>
                                <td style={{ fontSize: '10px' }}>{row.name}</td>
                                <td style={{ textAlign: 'left', fontWeight: 700, color: row.np > 0 ? T.rose : '#94a3b8' }}>{row.np}</td>
                                <td style={{ textAlign: 'left', fontWeight: 700, color: row.p > 0 ? T.teal : '#94a3b8' }}>{row.p}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Communication Lines */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Communication Lines</div>
                        <span style={{ fontSize: '10px', color: T.rose, background: 'rgba(244,63,94,0.15)', padding: '2px 8px', borderRadius: '4px' }}>DOWN</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {details.infrastructure.filter(i => i.type === 'communication').slice(0, 4).map((c, i) => (
                          <div key={i} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700 }}>{c.city}</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{c.loc}</div>
                            <div style={{ marginTop: 6 }}><span style={{ fontSize: '8px', background: 'rgba(244,63,94,0.15)', color: T.rose, padding: '2px 4px', borderRadius: 4, fontWeight: 800 }}>INTERRUPTED</span></div>
                          </div>
                        ))}
                        {details.infrastructure.filter(i => i.type === 'communication').length === 0 && (
                          <div style={{ gridColumn: 'span 2', textAlign: 'left', padding: '1rem', color: '#94a3b8' }}>All lines operational</div>
                        )}
                      </div>
                    </div>

                    {/* Water Supply */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Water Supply</div>
                        <span style={{ fontSize: '10px', color: T.blue, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>LATEST</span>
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                        <table className="premium-table">
                          <thead><tr><th>Municipality</th><th>Area</th><th>Status</th></tr></thead>
                          <tbody>
                            {details.infrastructure.filter(i => i.type === 'water').length > 0 ? (
                              details.infrastructure.filter(i => i.type === 'water').sort((a,b) => (a.status === 'interrupted' ? -1 : 1)).map((w, i) => (
                                <tr key={i} className="trow">
                                  <td>{w.city || w.mun}</td>
                                  <td style={{ fontSize: '10px' }}>{w.name || w.area || 'Entire Municipality'}</td>
                                  <td>
                                    <span style={{ fontSize: '9px', fontWeight: 800, background: w.status === 'operational' ? 'rgba(0,201,160,0.1)' : 'rgba(240,69,69,0.1)', color: w.status === 'operational' ? T.teal : T.rose, padding: '2px 6px', borderRadius: '4px' }}>
                                      {w.status?.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan="3" style={{ textAlign: 'left', color: '#94a3b8', padding: '1.5rem' }}>No water utility interruptions reported</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
                    {/* Power Supply Full List */}
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Detailed Power Interruption Log</div>
                        <span style={{ fontSize: '10px', color: T.rose, background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>ALL AREAS</span>
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Municipality</th>
                              <th>Barangay / Area</th>
                              <th>Service Provider</th>
                              <th>Status</th>
                              <th>Restoration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.infrastructure.filter(i => i.type === 'power').length > 0 ? (
                              details.infrastructure
                                .filter(i => i.type === 'power')
                                .sort((a,b) => (a.status === 'interrupted' ? -1 : 1))
                                .map((p, i) => (
                                <tr key={i} className="trow">
                                  <td style={{ fontWeight: 600 }}>{p.city}</td>
                                  <td style={{ fontSize: '11px' }}>{p.name || 'Entire Municipality'}</td>
                                  <td style={{ fontSize: '11px', color: '#64748b' }}>{p.provider || '—'}</td>
                                  <td>
                                    <span style={{ 
                                      fontSize: '9px', 
                                      fontWeight: 800, 
                                      background: p.status === 'interrupted' ? 'rgba(244,63,94,0.1)' : 'rgba(0,201,160,0.1)', 
                                      color: p.status === 'interrupted' ? T.rose : T.teal, 
                                      padding: '2px 6px', 
                                      borderRadius: '4px' 
                                    }}>
                                      {p.status?.toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '10px', color: '#64748b', fontFamily: 'DM Mono' }}>
                                    {p.restored ? new Date(p.restored).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan="5" style={{ textAlign: 'left', color: '#94a3b8', padding: '3rem' }}>No power interruption records found in latest reports</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* General Infrastructure Damage */}
                  <div className="premium-card" style={{ marginTop: 14 }}>
                    <div className="premium-card-header">
                      <div className="premium-card-title">General Infrastructure Damage</div>
                      <span style={{ fontSize: '10px', color: T.indigo, background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px' }}>REPORTS</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th>Infrastructure</th>
                            <th>Type</th>
                            <th>Municipality</th>
                            <th>Qty</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'left' }}>Cost (PHP)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.infraDamage.length > 0 ? (
                            details.infraDamage.map((infra, i) => (
                              <tr key={i} className="trow">
                                <td style={{ fontWeight: 600 }}>{infra.name}</td>
                                <td><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#64748b' }}>{infra.type}</span></td>
                                <td>{infra.city}</td>
                                <td>{infra.qty}</td>
                                <td>
                                  <span style={{
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    background: infra.status === 'Ongoing' ? 'rgba(249,115,22,0.1)' : 'rgba(0,201,160,0.1)',
                                    color: infra.status === 'Ongoing' ? T.orange : T.teal,
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                  }}>
                                    {infra.status?.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontWeight: 700 }}>{infra.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="6" style={{ textAlign: 'left', color: '#94a3b8', padding: '2rem' }}>No infrastructure damage reports recorded</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Assistance' ? (
                <div className="category-viz-container">
                  {/* Critical Gap Callout Box */}
                  <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: T.rose, letterSpacing: '1px', marginBottom: '4px' }}>CRITICAL GAP ANALYSIS</div>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#991b1b' }}>
                        {Math.max(0, 100 - Math.round((Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.served, 0) / (Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.families, 0) || 1)) * 100))}% Unserved
                      </div>
                      <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>Estimated families awaiting relief commodities in high-impact zones.</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: T.rose }}>{(Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.families, 0) - Object.values(result?.details?.byCity || {}).reduce((s, p) => s + p.served, 0)).toLocaleString()}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>PENDING FAMILIES</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 14, marginBottom: 14 }}>
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Coverage by City</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                        {Object.entries(result?.details?.byCity || {}).sort((a, b) => b[1].families - a[1].families).slice(0, 4).map(([name, stats], i) => {
                          const coverage = Math.min(100, Math.round((stats.served / (stats.families || 1)) * 100));
                          return (
                            <div key={i}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
                                <span style={{ fontWeight: 700 }}>{name}</span>
                                <span style={{ color: T.teal, fontWeight: 700 }}>{coverage}%</span>
                              </div>
                              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${coverage}%`, height: '100%', background: coverage > 70 ? T.teal : T.amber }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Relief Items Dispatched</div>
                        <span style={{ fontSize: '10px', color: T.teal, background: 'rgba(0,201,160,0.1)', padding: '2px 8px', borderRadius: '4px' }}>LOGISTICS</span>
                      </div>
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="premium-table">
                          <thead><tr><th>Item Description</th><th style={{ textAlign: 'left' }}>Quantity</th><th>Unit</th></tr></thead>
                          <tbody>
                            {[
                              { item: 'Family Food Packs', qty: 15402, u: 'boxes' },
                              { item: 'Non-Food Items (Kitchen)', qty: 3200, u: 'sets' },
                              { item: 'Sleeping Kits', qty: 4500, u: 'sets' },
                              { item: 'Bottled Water (6L)', qty: 8900, u: 'bottles' },
                              { item: 'Hygiene Kits', qty: 2800, u: 'kits' }
                            ].map((row, i) => (
                              <tr key={i} className="trow">
                                <td style={{ fontWeight: 600 }}>{row.item}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', fontWeight: 700 }}>{row.qty.toLocaleString()}</td>
                                <td style={{ fontSize: '10px', color: '#64748b' }}>{row.u}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="premium-card">
                    <div className="premium-card-header">
                      <div className="premium-card-title">LGU & Agency Assistance Valuation</div>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                      <table className="premium-table">
                        <thead>
                          <tr><th>Municipality</th><th>Cost Valuation (PHP)</th><th style={{ textAlign: 'left' }}>Weight Share</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(result?.details?.assistanceByLgu || {}).length > 0 ? (
                            Object.entries(result.details.assistanceByLgu).sort((a, b) => b[1] - a[1]).map(([lgu, cost], i) => {
                              const totalCost = Object.values(result.details.assistanceByLgu).reduce((s, c) => s + c, 0) || 1;
                              return (
                                <tr key={i} className="trow">
                                  <td style={{ fontWeight: 600 }}>{lgu}</td>
                                  <td style={{ fontFamily: 'DM Mono', fontWeight: 700, color: '#166534' }}>₱ {cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td style={{ textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>{((cost / totalCost) * 100).toFixed(1)}%</span>
                                      <div style={{ width: '80px', height: '4px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${(cost / totalCost) * 100}%`, height: '100%', background: T.teal }} />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : <tr><td colSpan="3" style={{ textAlign: 'left', color: '#94a3b8', padding: '2rem' }}>No assistance valuation records available</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Suspension' ? (
                <div className="category-viz-container">
                  {/* State of Calamity Callout */}
                  {details.suspensions.some(s => s.type === 'stateOfCalamity') && (
                    <div style={{ background: 'rgba(240,69,69,0.05)', border: `1px solid ${T.rose}`, borderRadius: 12, padding: '1.25rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ background: T.rose, color: 'white', padding: '8px 12px', borderRadius: 8, fontWeight: 900, fontSize: '12px' }}>ALERT</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>State of Calamity Declared</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {details.suspensions.find(s => s.type === 'stateOfCalamity')?.city || 'Multiple Areas'} have officially declared a state of calamity.
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Suspension by City</div>
                      </div>
                      <div style={{ height: '270px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(result?.details?.byCity || {}).sort((a, b) => (details.suspensions.filter(s => s.city === b[0]).length) - (details.suspensions.filter(s => s.city === a[0]).length)).slice(0, 4).map(([name, stats]) => ({
                            name,
                            classes: details.suspensions.filter(s => s.city === name && s.type === 'classSuspension').length,
                            work: details.suspensions.filter(s => s.city === name && s.type === 'workSuspension').length
                          }))} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              interval={0}
                              tick={<CustomizedAxisTick />}
                              height={60}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Legend
                              iconType="circle"
                              wrapperStyle={{ fontSize: '10px', paddingTop: '10px', paddingBottom: '0px' }}
                              formatter={(value) => <span style={{ color: '#475569', fontWeight: 600, marginRight: '15px' }}>{value}</span>}
                            />
                            <Bar dataKey="classes" name="Class Suspensions" fill={T.indigo} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="work" name="Work Suspensions" fill={T.amber} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Recent Directives</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {details.suspensions.slice(0, 4).map((s, i) => (
                          <div key={i} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '8px', fontWeight: 800, color: s.type === 'classSuspension' ? T.indigo : T.amber, background: 'white', padding: '2px 4px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>{s.type === 'classSuspension' ? 'CLASS' : 'WORK'}</span>
                            <div style={{ fontSize: '11px', fontWeight: 700 }}>{s.name}</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{s.city}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="premium-card">
                    <div className="premium-card-header">
                      <div className="premium-card-title">Full Suspension Log</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="premium-table">
                        <thead>
                          <tr><th>LGU/Entity</th><th>Category</th><th>City / Municipality</th><th>Scope</th></tr>
                        </thead>
                        <tbody>
                          {result?.details?.suspensions?.length > 0 ? (
                            result.details.suspensions.map((s, i) => (
                              <tr key={i} className="trow">
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td>
                                  <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: s.type === 'classSuspension' ? 'rgba(99,102,241,0.1)' : 'rgba(232,117,48,0.1)', color: s.type === 'classSuspension' ? '#6366f1' : '#e87530', fontWeight: 700 }}>
                                    {s.type === 'classSuspension' ? 'CLASSES' : s.type === 'workSuspension' ? 'WORK' : 'CALAMITY'}
                                  </span>
                                </td>
                                <td style={{ fontSize: '11px', color: '#64748b' }}>{s.city}</td>
                                <td style={{ fontSize: '11px' }}>{s.city} (All Levels)</td>
                              </tr>
                            ))
                          ) : <tr><td colSpan="4" style={{ textAlign: 'left', color: '#94a3b8', padding: '2rem' }}>Normal operations reported</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'Pre-Evacuation' ? (
                <div className="category-viz-container">
                  {/* KPI Row for Pre-Evacuation */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                    <div className="kpi-card-premium blue">
                      <div className="kpi-label-premium">Families</div>
                      <div className="kpi-value-premium">{details.preEvacuation.reduce((s, p) => s + p.fam, 0).toLocaleString()}</div>
                      <div className="kpi-sub-premium">Total pre-empted</div>
                    </div>
                    <div className="kpi-card-premium purple">
                      <div className="kpi-label-premium">Persons</div>
                      <div className="kpi-value-premium">{details.preEvacuation.reduce((s, p) => s + p.per, 0).toLocaleString()}</div>
                      <div className="kpi-sub-premium">Across all centers</div>
                    </div>
                    <div className="kpi-card-premium teal">
                      <div className="kpi-label-premium">Active ECs</div>
                      <div className="kpi-value-premium">{[...new Set(details.preEvacuation.map(p => p.ec))].length}</div>
                      <div className="kpi-sub-premium">Facilities utilized</div>
                    </div>
                    <div className="kpi-card-premium orange">
                      <div className="kpi-label-premium">LGUs</div>
                      <div className="kpi-value-premium">{[...new Set(details.preEvacuation.map(p => p.mun))].length}</div>
                      <div className="kpi-sub-premium">Participating areas</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 14, marginBottom: 14 }}>
                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Evacuation Demographics</div>
                        <span style={{ fontSize: '10px', color: T.rose, background: 'rgba(244,63,94,0.15)', padding: '2px 8px', borderRadius: '4px' }}>SEX CLASSIFICATION</span>
                      </div>
                      <div style={{ height: '260px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Male', value: result?.details?.sexDistribution?.male || 0 },
                            { name: 'Female', value: result?.details?.sexDistribution?.female || 0 }
                          ]} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{ fill: 'transparent' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div style={{ background: 'white', padding: '10px 14px', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
                                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{payload[0].payload.name}</div>
                                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{payload[0].value.toLocaleString()} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>Persons</span></div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={45}>
                              <Cell fill={T.blue} />
                              <Cell fill={T.rose} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="premium-card">
                      <div className="premium-card-header">
                        <div className="premium-card-title">Top Municipalities (Pre-Evac)</div>
                      </div>
                      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        <table className="premium-table">
                          <thead><tr><th>Municipality</th><th style={{ textAlign: 'left' }}>Families</th><th style={{ textAlign: 'left' }}>Persons</th></tr></thead>
                          <tbody>
                            {details.preEvacuation.slice(0, 4).map((r, i) => (
                              <tr key={i} className="trow">
                                <td style={{ fontWeight: 600 }}>{r.mun}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono' }}>{r.fam.toLocaleString()}</td>
                                <td style={{ textAlign: 'left', fontFamily: 'DM Mono', color: '#64748b' }}>{r.per.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {/* Damaged Houses Section (Integrated into Pre-Evacuation reporting as per plan) */}
                  <div className="premium-card">
                    <div className="premium-card-header">
                      <div className="premium-card-title">Damaged Houses — City Breakdown</div>
                      <span style={{ fontSize: '10px', color: T.orange, background: 'rgba(249,115,22,0.15)', padding: '2px 8px', borderRadius: '4px' }}>HOUSING IMPACT</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 1fr', gap: '1.5rem' }}>
                      <div style={{ height: '300px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={Object.entries(result?.details?.byCity || {}).filter(([_, stats]) => stats.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 4).map(([name, stats]) => ({ name, total: stats.dmg_total || 0, partial: stats.dmg_partial || 0 }))} margin={{ bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="total" name="Totally Damaged" fill={T.red} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="partial" name="Partially Damaged" fill={T.orange} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                        <table className="premium-table">
                          <thead>
                            <tr><th>Municipality</th><th>Totally</th><th>Partially</th><th>Combined</th></tr>
                          </thead>
                          <tbody>
                            {Object.entries(result?.details?.byCity || {}).filter(([_, stats]) => stats.dmg > 0).length > 0 ? (
                              Object.entries(result?.details?.byCity || {}).filter(([_, stats]) => stats.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg).map(([city, stats], i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 600 }}>{city}</td>
                                  <td style={{ textAlign: 'left', color: T.rose, fontWeight: 700 }}>{stats.dmg_total || 0}</td>
                                  <td style={{ textAlign: 'left', color: T.orange, fontWeight: 700 }}>{stats.dmg_partial || 0}</td>
                                  <td style={{ textAlign: 'left', fontWeight: 700, fontFamily: 'DM Mono', color: T.dark }}>{stats.dmg}</td>
                                </tr>
                              ))
                            ) : <tr><td colSpan="4" style={{ textAlign: 'left', color: '#94a3b8' }}>No housing damage reported</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      <HeaderFooterModal
        isOpen={showEditEventModal}
        onClose={() => setShowEditEventModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '10px', borderRadius: '10px' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>Edit Event</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 400 }}>Modify event details.</div>
            </div>
          </div>
        }
        maxWidth="640px"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowEditEventModal(false)} style={{ height: '42px', padding: '0 20px' }}>Cancel</button>
            <button 
              className="btn-primary" 
              onClick={async () => {
                const success = await updateEvent(selectedEventIdToEdit, editForm)
                if (success !== false) setShowEditEventModal(false)
              }}
              style={{ height: '42px', padding: '0 24px' }}
            >
              Save Changes
            </button>
          </>
        }
      >
        <div style={{ padding: '4px' }}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Event Name</label>
            <input
              type="text"
              placeholder="e.g. Tropical Cyclone Kristine"
              value={editForm.name}
              onChange={(e) => {
                const val = e.target.value;
                setEditForm((f) => ({ ...f, name: val.charAt(0).toUpperCase() + val.slice(1) }));
              }}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Event Type</label>
              <select
                value={editForm.eventType}
                onChange={(e) => setEditForm((f) => ({ ...f, eventType: e.target.value, alertLevel: '' }))}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white' }}
              >
                <option value="calamity">Calamity</option>
                <option value="typhoon">Tropical Cyclone</option>
                <option value="flood">Flood</option>
                <option value="earthquake">Earthquake</option>
                <option value="fire">Fire Incident</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Alert Color Status</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { value: 'red', label: 'Red (Critical)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: '#b91c1c' },
                  { value: 'blue', label: 'Blue (Standard)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', text: '#1d4ed8' },
                  { value: 'white', label: 'White (Normal)', color: '#94a3b8', bg: '#f8fafc', text: '#475569' }
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, alertStatus: item.value, color: item.color }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: editForm.alertStatus === item.value ? item.color : '#e2e8f0',
                      background: editForm.alertStatus === item.value ? item.bg : 'white',
                      color: editForm.alertStatus === item.value ? item.text : '#475569',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    {item.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
              {editForm.eventType === 'typhoon' ? 'Tropical Cyclone Category' : 'Alert Level / Warning Signal'}
            </label>
            <select
              value={editForm.alertLevel || ''}
              onChange={(e) => setEditForm((f) => ({ ...f, alertLevel: e.target.value }))}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: 'white', color: '#1e293b'
              }}
            >
              {(ALERT_LEVELS[editForm.eventType] || ALERT_LEVELS.calamity).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {editForm.alertLevel && (
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                This will be displayed in the dashboard meta bar.
              </p>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Affected Provinces</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PROVINCE_NAMES.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`province-tag ${editForm.affectedProvinces?.includes(p) ? 'active' : ''}`}
                  onClick={() => {
                    setEditForm(f => ({
                      ...f,
                      affectedProvinces: f.affectedProvinces?.includes(p)
                        ? f.affectedProvinces.filter(x => x !== p)
                        : [...(f.affectedProvinces || []), p]
                    }))
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: editForm.affectedProvinces?.includes(p) ? '#6366f1' : 'white',
                    color: editForm.affectedProvinces?.includes(p) ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <ModernDateTimePicker
              label="Event Start"
              value={editForm.startDate}
              onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <ModernDateTimePicker
              label="Event End (Optional)"
              value={editForm.endDate}
              onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={showLguDeploymentModal && !!selectedEventToDeploy}
        onClose={() => setShowLguDeploymentModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '10px', borderRadius: '10px' }}>
              <PaperPlaneRight size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>Deploy to LGUs</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 400 }}>Event: {selectedEventToDeploy?.name}</div>
            </div>
          </div>
        }
        maxWidth="500px"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowLguDeploymentModal(false)} style={{ height: '42px', padding: '0 20px' }}>Cancel</button>
            <button 
              className="btn-primary" 
              disabled={lguForm.cities.length === 0}
              onClick={handleLguDeploySubmit}
              style={{ height: '42px', padding: '0 24px' }}
            >
              Deploy to {lguForm.cities.length} LGUs
            </button>
          </>
        }
      >
        <div style={{ padding: '4px' }}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '12px' }}>Select Affected LGUs in {user.province}</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px'
            }}>
              {getCitiesForProvince(user.province).map(city => {
                const isAlreadyDeployed = eventDeployments.some(d => d.city === city && d.event_id === selectedEventToDeploy?.id)
                return (
                  <label key={city} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1.5px solid',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.875rem',
                    background: lguForm.cities.includes(city) ? '#f5f3ff' : 'white',
                    borderColor: lguForm.cities.includes(city) ? '#6366f1' : '#e2e8f0',
                    color: lguForm.cities.includes(city) ? '#4338ca' : '#475569'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={lguForm.cities.includes(city)}
                        onChange={() => {
                          setLguForm(prev => ({
                            ...prev,
                            cities: prev.cities.includes(city)
                              ? prev.cities.filter(c => c !== city)
                              : [...prev.cities, city]
                          }))
                        }}
                        style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontWeight: 600 }}>{city}</span>
                    </div>
                    {isAlreadyDeployed && (
                      <span style={{ fontSize: '9px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, letterSpacing: '0.025em' }}>DEPLOYED</span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Strength Label</label>
              <select
                value={lguForm.strengthLabel}
                onChange={e => setLguForm({ ...lguForm, strengthLabel: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b' }}
              >
                <option value="Rainfall">Rainfall</option>
                <option value="Wind Signal">Wind Signal</option>
                <option value="Intensity">Intensity</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Strength Value</label>
              <input
                type="text"
                value={lguForm.strengthValue}
                onChange={e => setLguForm({ ...lguForm, strengthValue: e.target.value })}
                placeholder="e.g. Heavy, Signal 2"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b' }}
              />
            </div>
          </div>
        </div>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={showSelectEventToEdit}
        onClose={() => setShowSelectEventToEdit(false)}
        title="Select Event"
        maxWidth="440px"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowSelectEventToEdit(false)} style={{ height: '42px', padding: '0 20px' }}>Cancel</button>
            <button 
              className="btn-primary" 
              disabled={!selectedEventIdToEdit}
              onClick={() => {
                const ev = events.find(e => e.id === selectedEventIdToEdit)
                if (ev) {
                  setShowSelectEventToEdit(false)
                  setIsEditingExistingEvent(true)
                  setEditForm({ ...ev, affectedProvinces: ev.affectedProvinces || [] })
                  setShowEditEventModal(true)
                }
              }}
              style={{ height: '42px', padding: '0 24px' }}
            >
              Continue
            </button>
          </>
        }
      >
        <div className="event-selection-list">
          {events.map(ev => (
            <div
              key={ev.id}
              className={`event-selection-card ${selectedEventIdToEdit === ev.id ? 'active' : ''}`}
              onClick={() => setSelectedEventIdToEdit(ev.id)}
            >
              <div className="event-selection-avatar" style={{ background: ev.color }}>{ev.name.charAt(0)}</div>
              <div className="event-selection-info">
                <span className="event-selection-name">{ev.name}</span>
              </div>
            </div>
          ))}
        </div>
      </HeaderFooterModal>

      {/* Signal Details Modal (Image 2 replacement for deployment notifications) */}
      <HeaderFooterModal
        isOpen={showSignalDetailsModal && !!selectedEventToDeploy}
        onClose={() => setShowSignalDetailsModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '10px', borderRadius: '10px' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>Event Details</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 400 }}>Manage hierarchy and signals for this event.</div>
            </div>
          </div>
        }
        maxWidth="650px"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowSignalDetailsModal(false)} style={{ height: '42px', padding: '0 20px' }}>Cancel</button>
            <button className="btn-primary" onClick={() => setShowSignalDetailsModal(false)} style={{ height: '42px', padding: '0 24px' }}>Done</button>
          </>
        }
      >
        <div style={{ padding: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <MagnifyingGlass size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text"
                placeholder={`Search LGUs...`}
                value={signalSearchTerm}
                onChange={(e) => setSignalSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  background: '#f8fafc',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '4px' }}>
              <Button variant="solid" size="sm">LGUs</Button>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>LGU STATUS</span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Apply to All:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => bulkAssignSignals(selectedEventToDeploy?.id, user.province, getCitiesForProvince(user.province), String(s))}
                      style={{
                        width: '24px', height: '24px', borderRadius: '4px',
                        background: 'white', color: '#64748b', border: '1px solid #e2e8f0',
                        fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => bulkAssignSignals(selectedEventToDeploy?.id, user.province, getCitiesForProvince(user.province), null)}
                    style={{
                      width: '24px', height: '24px', borderRadius: '4px',
                      background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                      fontSize: '0.7rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {getCitiesForProvince(user.province)
                .filter(city => city.toLowerCase().includes(signalSearchTerm.toLowerCase()))
                .map(city => {
                  const signalData = eventSignals.find(s => s.city === city && !s.barangay && s.event_id === selectedEventToDeploy?.id)
                  const currentSignal = signalData?.signal
                  const SIGNAL_COLORS = {
                    '1': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
                    '2': { bg: '#fffbeb', text: '#d97706', border: '#fef3c7' },
                    '3': { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
                    '4': { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
                    '5': { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' }
                  }

                  return (
                    <div key={city} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '32px', height: '32px', borderRadius: '8px', 
                          background: currentSignal ? SIGNAL_COLORS[currentSignal].bg : '#f8fafc',
                          color: currentSignal ? SIGNAL_COLORS[currentSignal].text : '#94a3b8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 800,
                          border: currentSignal ? `1px solid ${SIGNAL_COLORS[currentSignal].border}` : '1px solid #e2e8f0'
                        }}>
                          {currentSignal || '-'}
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{city}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => assignSignal(selectedEventToDeploy?.id, user.province, city, null, String(s))}
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: String(s) === currentSignal ? SIGNAL_COLORS[s].bg : 'white',
                              color: String(s) === currentSignal ? SIGNAL_COLORS[s].text : '#94a3b8',
                              border: `1.5px solid ${String(s) === currentSignal ? SIGNAL_COLORS[s].border : '#f1f5f9'}`,
                              fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => assignSignal(selectedEventToDeploy?.id, user.province, city, null, null)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            background: 'white', color: '#ef4444', border: '1.5px solid #fee2e2',
                            fontSize: '0.75rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <X size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        </div>
      </HeaderFooterModal>
      
      <HeaderFooterModal
        isOpen={showAffectedPersonsModal}
        onClose={() => setShowAffectedPersonsModal(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '10px', borderRadius: '10px' }}>
              <Warning size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1e293b' }}>Affected Persons</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 400 }}>
                Who and where — by barangay and city
              </div>
            </div>
          </div>
        }
        maxWidth="620px"
        footer={
          <button className="btn-secondary" onClick={() => setShowAffectedPersonsModal(false)} style={{ height: '42px', padding: '0 20px' }}>
            Close
          </button>
        }
      >
        {(() => {
          const byCity = result?.details?.byCity || {}
          const hasCityData = Object.keys(byCity).length > 0

          const affectedCard = categoryCards.find(c => c.category === 'affectedPopulation')
          const barangayRows = affectedCard?.barangayData || []
          const hasBarangayData = barangayRows.length > 0

          if (!hasCityData && !hasBarangayData) {
            return (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                <Warning size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>No affected persons data</div>
                <div style={{ fontSize: '0.8125rem' }}>Who: None — Where: None</div>
              </div>
            )
          }

          return (
            <div>
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  {
                    label: 'Total Persons',
                    value: Object.values(byCity).reduce((s, p) => s + p.persons, 0).toLocaleString(),
                    color: '#3b82f6', bg: 'rgba(59,130,246,0.07)'
                  },
                  {
                    label: 'Total Families',
                    value: Object.values(byCity).reduce((s, p) => s + p.families, 0).toLocaleString(),
                    color: '#6366f1', bg: 'rgba(99,102,241,0.07)'
                  },
                  {
                    label: 'Cities / Munis',
                    value: Object.keys(byCity).length,
                    color: '#14b8a6', bg: 'rgba(20,184,166,0.07)'
                  }
                ].map((stat, i) => (
                  <div key={i} style={{ background: stat.bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* City breakdown table */}
              {hasCityData && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    By city / municipality
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Municipality</th>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Persons</th>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Families</th>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Barangays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(byCity)
                          .filter(([_, s]) => s.persons > 0 || s.families > 0)
                          .sort((a, b) => b[1].persons - a[1].persons)
                          .map(([city, stats], i) => (
                            <tr key={city} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1e293b' }}>{city}</td>
                              <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 700 }}>{stats.persons.toLocaleString()}</td>
                              <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#6366f1' }}>{stats.families.toLocaleString()}</td>
                              <td style={{ padding: '9px 14px', color: '#64748b' }}>{stats.brgys?.size || 0}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Barangay breakdown */}
              {hasBarangayData && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    By barangay
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', maxHeight: '240px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>Barangay</th>
                          <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barangayRows.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 14px', color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{row.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </HeaderFooterModal>
      </div >
    </>
  );
}
