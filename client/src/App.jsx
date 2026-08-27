import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import api from './services/api'
import { getSocket } from './services/socket'
import { addSongToQueue, removeSongFromQueue, skipCurrentSong, notifySongEnded } from './services/youtube'

import Logo from './components/Logo'
import TicketCard from './components/TicketCard'
import NowPlaying from './components/NowPlaying'
import AddSongModal from './components/AddSongModal'
import Queue from './components/Queue'
import MyRequests from './components/MyRequests'
import HostControls from './components/HostControls'
import TurnBalance from './components/TurnBalance'

import { LogOut, ArrowRight, Ticket, PlayCircle, Sun, Moon } from 'lucide-react'

function App() {
  // Theme State: 'dark' or 'light'
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('triptune_theme') === 'light' ? 'light' : 'dark'
    } catch (e) {
      return 'dark'
    }
  })

  useLayoutEffect(() => {
    const isLight = theme === 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.body.classList.toggle('theme-light', isLight)
    try {
      localStorage.setItem('triptune_theme', theme)
    } catch (e) {}
  }, [theme])

  // Always default to 'home' landing page on clean load
  const [mode, setMode] = useState('home') // 'home', 'create', 'join', 'trip'

  // Persisted Trip & User Sessions
  const [activeTrip, setActiveTrip] = useState(() => {
    try {
      const saved = localStorage.getItem('triptune_active_trip')
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('triptune_user')
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  const [currentSong, setCurrentSong] = useState(null)
  const [queue, setQueue] = useState([])
  const [members, setMembers] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [queueLocked, setQueueLocked] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)

  // Form States
  const [tripName, setTripName] = useState('')
  const [hostName, setHostName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [passengerName, setPassengerName] = useState('')

  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const socketStateReceivedRef = useRef(false)

  // Helper session savers
  const saveTripSession = (trip) => {
    if (!trip) return
    setActiveTrip(trip)
    try {
      localStorage.setItem('triptune_active_trip', JSON.stringify(trip))
    } catch (e) {}
  }

  const saveUserSession = (user) => {
    if (!user) return
    setCurrentUser(user)
    try {
      localStorage.setItem('triptune_user', JSON.stringify(user))
    } catch (e) {}
  }

  const clearSessionAndGoHome = (msg) => {
    localStorage.removeItem('triptune_active_trip')
    localStorage.removeItem('triptune_user')
    setActiveTrip(null)
    setCurrentUser(null)
    setMode('home')
    if (msg) showNotification(msg)
  }

  const showNotification = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  // Check URL parameters for shareable join link (e.g. ?code=GOA247)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const codeFromUrl = params.get('code')
      if (codeFromUrl) {
        setJoinCode(codeFromUrl.toUpperCase())
        setMode('join')
      }
    } catch (e) {}
  }, [])

  // Fetch initial trip details via HTTP REST on entering trip mode
  const fetchTripDetails = async (tripId) => {
    if (!tripId) return
    try {
      const res = await api.get(`/trips/${tripId}`)
      if (res.data) {
        if (socketStateReceivedRef.current) return
        if (res.data.trip) saveTripSession(res.data.trip)
        if (res.data.currentSong !== undefined) setCurrentSong(res.data.currentSong)
        if (res.data.queue) setQueue(res.data.queue)
        if (res.data.members) setMembers(res.data.members)
        if (res.data.queueLocked !== undefined) setQueueLocked(res.data.queueLocked)
        if (res.data.trip?.isPlaying !== undefined) setIsPlaying(res.data.trip.isPlaying)
      }
    } catch (err) {
      console.error('Fetch trip details error:', err)
      if (err.response?.status === 404 || err.response?.status === 400) {
        clearSessionAndGoHome('Active trip expired or not found.')
      }
    }
  }

  useEffect(() => {
    if (mode === 'trip' && activeTrip?._id) {
      fetchTripDetails(activeTrip._id)
    }
  }, [mode, activeTrip?._id])

  // Socket.IO Multi-user Synchronization Listener
  useEffect(() => {
    if (mode !== 'trip' || !activeTrip?._id || !currentUser?._id) return

    const socket = getSocket()
    socketStateReceivedRef.current = false

    const joinRoom = () => {
      socket.emit('joinTrip', {
        tripId: activeTrip._id,
        userId: currentUser._id,
        sessionId: currentUser.sessionId
      })
    }

    socket.on('connect', joinRoom)

    if (socket.connected) joinRoom()

    const handleTripState = (state) => {
      socketStateReceivedRef.current = true
      if (state.trip) saveTripSession(state.trip)
      if (state.currentSong !== undefined) setCurrentSong(state.currentSong)
      if (state.queue) setQueue(state.queue)
      if (state.members) setMembers(state.members)
      if (state.queueLocked !== undefined) setQueueLocked(state.queueLocked)
      if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying)
    }

    const handleQueueUpdated = (state) => {
      if (state.currentSong !== undefined) setCurrentSong(state.currentSong)
      if (state.queue) setQueue(state.queue)
    }

    const handlePlaybackStateChanged = (data) => {
      if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying)
      if (data.currentSong !== undefined) setCurrentSong(data.currentSong)
    }

    const handleQueueLocked = (data) => {
      if (data.queueLocked !== undefined) setQueueLocked(data.queueLocked)
    }

    const handleSongAdded = (data) => {
      if (data.message) showNotification(data.message)
    }

    const handleMemberJoined = (data) => {
      if (data.members) setMembers(data.members)
      if (data.displayName) showNotification(`RIDER ${data.displayName.toUpperCase()} BOARDED THE BUS`)
    }

    const handleMemberLeft = (data) => {
      if (data.members) setMembers(data.members)
    }

    const handleTripEnded = () => {
      showNotification('ROUTE ENDED BY HOST')
      setTimeout(() => {
        handleLeaveTrip()
      }, 2000)
    }

    const handleSocketError = (err) => {
      if (err.message) showNotification(`⚠️ ${err.message}`)
      if (err.message && (err.message.includes('not found') || err.message.includes('ended'))) {
        clearSessionAndGoHome('Trip expired or not found.')
      }
    }

    socket.on('tripState', handleTripState)
    socket.on('queueUpdated', handleQueueUpdated)
    socket.on('playbackStateChanged', handlePlaybackStateChanged)
    socket.on('queueLocked', handleQueueLocked)
    socket.on('songAdded', handleSongAdded)
    socket.on('memberJoined', handleMemberJoined)
    socket.on('memberLeft', handleMemberLeft)
    socket.on('tripEnded', handleTripEnded)
    socket.on('error', handleSocketError)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('tripState', handleTripState)
      socket.off('queueUpdated', handleQueueUpdated)
      socket.off('playbackStateChanged', handlePlaybackStateChanged)
      socket.off('queueLocked', handleQueueLocked)
      socket.off('songAdded', handleSongAdded)
      socket.off('memberJoined', handleMemberJoined)
      socket.off('memberLeft', handleMemberLeft)
      socket.off('tripEnded', handleTripEnded)
      socket.off('error', handleSocketError)
    }
  }, [mode, activeTrip?._id, currentUser?._id])

  // Form Handlers
  const handleCreateTrip = async (e) => {
    e.preventDefault()
    if (!tripName || !hostName) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await api.post('/trips', { name: tripName, hostName })
      const tripData = {
        _id: res.data.tripId,
        name: tripName,
        joinCode: res.data.joinCode,
        hostName: hostName
      }
      saveTripSession(tripData)
      saveUserSession(res.data.hostUser)
      setMode('trip')
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create trip route pass')
    } finally {
      setActionLoading(false)
    }
  }

  const handleJoinTrip = async (e) => {
    e.preventDefault()
    if (!joinCode || !passengerName) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await api.post('/trips/join', { joinCode, displayName: passengerName })
      saveTripSession(res.data.trip)
      saveUserSession(res.data.user)
      if (res.data.currentSong !== undefined) setCurrentSong(res.data.currentSong)
      if (res.data.queue) setQueue(res.data.queue)
      if (res.data.queueLocked !== undefined) setQueueLocked(res.data.queueLocked)
      setMode('trip')
    } catch (err) {
      setActionError(err.response?.data?.message || 'Invalid join code or failed to board')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddSong = async (songData) => {
    if (!activeTrip?._id || !currentUser?._id) return
    try {
      const res = await addSongToQueue(activeTrip._id, currentUser._id, currentUser.sessionId, songData)
      if (res?.message) showNotification(res.message)
    } catch (err) {
      const message = err.response?.data?.message || 'Could not add that song. Please try again.'
      showNotification(message)
      throw new Error(message)
    }
  }

  const handleRemoveSong = async (songId) => {
    if (!activeTrip?._id || !currentUser?._id) return
    try {
      await removeSongFromQueue(activeTrip._id, songId, currentUser._id, currentUser.sessionId)
      showNotification('Song removed from the queue.')
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not remove that song.')
    }
  }

  const handlePlayToggle = () => {
    if (!activeTrip?._id || !currentUser?._id) return
    const socket = getSocket()
    const action = isPlaying ? 'pauseSong' : 'playSong'
    socket.emit(action, { tripId: activeTrip._id, userId: currentUser._id })
  }

  const handleSkip = async () => {
    if (!activeTrip?._id || !currentUser?._id) return
    await skipCurrentSong(activeTrip._id, currentUser._id, currentUser.sessionId)
  }

  const handleSongEnded = async (songId) => {
    if (!activeTrip?._id || !currentUser?._id || !isHost) return
    try {
      await notifySongEnded(activeTrip._id, songId, currentUser._id, currentUser.sessionId)
    } catch (err) {
      showNotification('Could not advance the queue. Please try again.')
    }
  }

  const handleLockToggle = () => {
    if (!activeTrip?._id || !currentUser?._id) return
    const socket = getSocket()
    socket.emit('lockQueue', { tripId: activeTrip._id, userId: currentUser._id })
  }

  const handleEndTrip = () => {
    if (!activeTrip?._id || !currentUser?._id) return
    if (!window.confirm('End this trip route for all riders?')) return
    const socket = getSocket()
    socket.emit('endTrip', { tripId: activeTrip._id, userId: currentUser._id })
  }

  const handleLeaveTrip = () => {
    if (activeTrip?._id && currentUser?._id) {
      const socket = getSocket()
      socket.emit('leaveTrip', { tripId: activeTrip._id, userId: currentUser._id })
    }
    clearSessionAndGoHome()
  }

  const isHost = currentUser?.role === 'HOST'
  const myPendingCount = queue.filter(s => s.userId === currentUser?._id || (s.userId && s.userId.toString() === currentUser?._id?.toString())).length

  return (
    <div className="min-h-screen flex flex-col font-sans relative transition-colors duration-200">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 bg-[#2457D6] text-white font-mono font-bold text-xs rounded border border-[#2457D6] shadow-xl flex items-center gap-2 uppercase tracking-wider">
          <span>{notification}</span>
        </div>
      )}

      {/* Minimal Top Header */}
      <header className="border-b border-[#D8D8D2]/40 bg-white/5 px-6 py-4 flex items-center justify-between shadow-sm">
        <button onClick={() => setMode('home')} className="text-left focus:outline-none hover:opacity-90 transition-opacity">
          <Logo />
        </button>
        <div className="font-mono text-xs text-[#72767A] flex items-center gap-3">
          {/* Dark / Light Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="px-3 py-1 bg-[#2457D6]/10 hover:bg-[#2457D6]/20 text-[#2457D6] font-mono text-[11px] font-bold rounded border border-[#2457D6]/30 flex items-center gap-1.5 transition-colors"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" /> LIGHT MODE
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" /> DARK MODE
              </>
            )}
          </button>

          <span className="hidden sm:inline">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
          
          {activeTrip && (
            <button
              onClick={() => {
                if (mode === 'trip') {
                  setShowTicketModal(!showTicketModal)
                } else {
                  setMode('trip')
                }
              }}
              className="px-3 py-1 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors"
            >
              <Ticket className="w-3.5 h-3.5" />
              {mode === 'trip' ? 'ROUTE PASS' : 'OPEN ROUTE'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {/* HOMEPAGE - THE ROAD MAP COVER */}
        {mode === 'home' && (
          <div className="max-w-2xl mx-auto py-6 sm:py-12 space-y-8">
            {/* Active Resume Ride Banner (If user has an active session saved) */}
            {activeTrip && currentUser && (
              <div className="p-4 bg-white/5 border border-[#2457D6]/40 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                <div>
                  <div className="font-mono text-[10px] text-[#2457D6] font-bold uppercase tracking-widest">
                    ACTIVE ROUTE SESSION
                  </div>
                  <div className="font-heading font-extrabold text-lg">
                    {activeTrip.name} (CODE: {activeTrip.joinCode})
                  </div>
                  <div className="font-sans text-xs opacity-75 mt-0.5">
                    Logged in as <span className="text-[#2457D6] font-bold">{currentUser.displayName}</span> ({currentUser.role})
                  </div>
                </div>

                <button
                  onClick={() => setMode('trip')}
                  className="px-5 py-2.5 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <PlayCircle className="w-4 h-4 fill-current" />
                  RESUME ROUTE →
                </button>
              </div>
            )}

            {/* Main Road Map Header */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="font-heading font-extrabold text-4xl sm:text-5xl tracking-tight leading-none uppercase">
                  YOUR ROUTE.<br />
                  <span className="text-[#2457D6]">YOUR MUSIC.</span>
                </h1>

                {/* Abstract Route Graphic */}
                <div className="py-6 my-2 bg-white/5 border border-[#D8D8D2]/30 rounded-md p-6 font-mono text-xs font-bold">
                  <div className="flex items-center justify-between max-w-md mx-auto">
                    <div className="flex flex-col items-center">
                      <span className="text-[#2457D6] mb-1">START</span>
                      <div className="w-3 h-3 rounded-full bg-[#2457D6]" />
                    </div>

                    <div className="flex-1 mx-2 flex items-center">
                      <div className="h-[2px] w-full bg-[#2457D6]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#EF6245] mx-1 animate-ping" />
                      <div className="h-[2px] w-full bg-[#2457D6]" />
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[#2457D6] mb-1">DESTINATION</span>
                      <div className="w-3 h-3 rounded-full bg-[#2457D6]" />
                    </div>
                  </div>
                </div>

                <p className="font-sans text-base sm:text-lg opacity-80 max-w-lg">
                  A shared music queue that keeps the whole bus in rhythm.
                </p>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-[#D8D8D2]/30 py-8">
              <button
                onClick={() => { setMode('create'); setActionError(null); }}
                className="p-6 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-lg rounded-md text-left transition-colors flex flex-col justify-between group space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-mono text-xs font-bold text-white/80 uppercase">HOST ROUTE</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <div className="uppercase">CREATE A TRIP →</div>
                  <div className="font-sans text-xs text-white/80 font-medium normal-case mt-1">Start a new bus route and manage the playback</div>
                </div>
              </button>

              <button
                onClick={() => { setMode('join'); setActionError(null); }}
                className="p-6 bg-white/5 hover:bg-white/10 border border-[#D8D8D2]/30 font-mono font-bold text-lg rounded-md text-left transition-colors flex flex-col justify-between group space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-mono text-xs font-bold text-[#2457D6] uppercase">PASSENGER BOARDING</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-[#2457D6]" />
                </div>
                <div>
                  <div className="uppercase">JOIN A TRIP →</div>
                  <div className="font-sans text-xs opacity-75 font-medium normal-case mt-1">Enter 6-character code to join route & add songs</div>
                </div>
              </button>
            </div>

            {/* Travel Footer Tagline */}
            <div className="flex justify-between items-center font-mono text-xs opacity-70 pt-2">
              <span>THE ROAD MAP FOR YOUR MUSIC.</span>
              <span className="text-[#2457D6]">TRIPTUNE v1.0</span>
            </div>
          </div>
        )}

        {/* CREATE TRIP FORM */}
        {mode === 'create' && (
          <div className="max-w-md mx-auto py-8 space-y-6">
            <div className="flex justify-between items-center border-b border-[#D8D8D2]/30 pb-3">
              <h2 className="font-heading font-extrabold text-xl text-[#2457D6] uppercase tracking-wider">CREATE A TRIP</h2>
              <button onClick={() => setMode('home')} className="font-mono text-xs opacity-70 hover:opacity-100">
                CANCEL
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-white/5 border border-[#EF6245]/40 text-[#EF6245] rounded text-xs font-sans">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateTrip} className="space-y-4 font-sans">
              <div>
                <label className="block font-mono text-xs opacity-70 mb-1.5 uppercase">TRIP ROUTE NAME</label>
                <input
                  type="text"
                  placeholder="e.g. PICT → GOA BUS 02"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-[#D8D8D2]/30 rounded text-current text-sm focus:outline-none focus:border-[#2457D6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs opacity-70 mb-1.5 uppercase">YOUR NAME (HOST)</label>
                <input
                  type="text"
                  placeholder="Your Name (e.g. Alex)"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-[#D8D8D2]/30 rounded text-current text-sm focus:outline-none focus:border-[#2457D6]"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3.5 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-sm tracking-wider uppercase rounded transition-colors"
              >
                {actionLoading ? 'GENERATING ROUTE PASS...' : 'CREATE TRIP & GET CODE →'}
              </button>
            </form>
          </div>
        )}

        {/* JOIN TRIP FORM */}
        {mode === 'join' && (
          <div className="max-w-md mx-auto py-8 space-y-6">
            <div className="flex justify-between items-center border-b border-[#D8D8D2]/30 pb-3">
              <h2 className="font-heading font-extrabold text-xl text-[#2457D6] uppercase tracking-wider">JOIN A TRIP</h2>
              <button onClick={() => setMode('home')} className="font-mono text-xs opacity-70 hover:opacity-100">
                CANCEL
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-white/5 border border-[#EF6245]/40 text-[#EF6245] rounded text-xs font-sans">
                {actionError}
              </div>
            )}

            <form onSubmit={handleJoinTrip} className="space-y-4 font-sans">
              <div>
                <label className="block font-mono text-xs opacity-70 mb-1.5 uppercase">6-CHARACTER ROUTE CODE</label>
                <input
                  type="text"
                  placeholder="e.g. GOA247"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-[#D8D8D2]/30 rounded text-current text-xl font-mono font-bold tracking-widest text-center uppercase focus:outline-none focus:border-[#2457D6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs opacity-70 mb-1.5 uppercase">YOUR NAME (PASSENGER)</label>
                <input
                  type="text"
                  placeholder="Passenger Name (e.g. Sanchita)"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-[#D8D8D2]/30 rounded text-current text-sm focus:outline-none focus:border-[#2457D6]"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3.5 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-sm tracking-wider uppercase rounded transition-colors"
              >
                {actionLoading ? 'JOINING ROUTE...' : 'JOIN THE ROUTE →'}
              </button>
            </form>
          </div>
        )}

        {/* TRIP ROOM - EDITORIAL TWO-COLUMN LAYOUT ON DESKTOP */}
        {mode === 'trip' && activeTrip && (
          <div className="space-y-6">
            {/* Header Route Metadata Bar */}
            <div className="bg-white/5 border border-[#D8D8D2]/30 rounded-md p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
              <div>
                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl uppercase tracking-wide flex items-center gap-2">
                  <span>{activeTrip.name || 'YOUR ROUTE'}</span>
                </h1>
                <div className="font-mono text-xs opacity-75 mt-1 flex items-center gap-3">
                  <span>HOST: {activeTrip.hostName || 'Host'}</span>
                  <span>•</span>
                  <span className="text-[#2457D6] font-bold">{members.length || 1} RIDERS ON BOARD</span>
                </div>
              </div>

              {/* Trip Pass Ticket Badge */}
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded border border-[#D8D8D2]/30">
                <div>
                  <div className="font-mono text-[9px] opacity-70 uppercase tracking-wider">ROUTE CODE</div>
                  <div className="font-mono text-lg font-extrabold text-[#2457D6] tracking-widest">
                    {activeTrip.joinCode}
                  </div>
                </div>
                <button
                  onClick={() => setShowTicketModal(true)}
                  className="px-3 py-1.5 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors"
                >
                  ROUTE PASS 🎫
                </button>
              </div>
            </div>

            {/* Ticket Pass Modal Dialog */}
            {showTicketModal && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="relative w-full max-w-sm">
                  <button
                    onClick={() => setShowTicketModal(false)}
                    className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-[#2457D6] text-white font-bold rounded-full flex items-center justify-center shadow-lg"
                  >
                    ✕
                  </button>
                  <TicketCard trip={activeTrip} joinCode={activeTrip.joinCode} />
                </div>
              </div>
            )}

            {/* Desktop Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Now Playing & Controls */}
              <div className="lg:col-span-7 space-y-6">
                {/* Host Controls */}
                {isHost && (
                  <HostControls
                    isPlaying={isPlaying}
                    queueLocked={queueLocked}
                    onPlayToggle={handlePlayToggle}
                    onSkip={handleSkip}
                    onLockToggle={handleLockToggle}
                    onEndTrip={handleEndTrip}
                  />
                )}

                {/* Now Playing Area */}
                <NowPlaying
                  currentSong={currentSong}
                  isHost={isHost}
                  isPlaying={isPlaying}
                  onSongEnded={handleSongEnded}
                  onPlayToggle={handlePlayToggle}
                  onSkip={handleSkip}
                />

                {/* Turn Order Fairness Indicator */}
                <TurnBalance members={members} queue={queue} />
              </div>

              {/* Right Column: Add Song, Queue, My Requests */}
              <div className="lg:col-span-5 space-y-6">
                {/* Add Song Component */}
                <AddSongModal
                  onAddSong={handleAddSong}
                  queueLocked={queueLocked}
                  pendingCount={myPendingCount}
                  maxPending={3}
                />

                {/* Route Ahead Queue */}
                <Queue
                  queue={queue}
                  currentUserId={currentUser?._id}
                  isHost={isHost}
                  onRemoveSong={handleRemoveSong}
                />

                {/* Passenger Requests */}
                <MyRequests
                  tripId={activeTrip._id}
                  userId={currentUser?._id}
                  sessionId={currentUser?.sessionId}
                  queue={queue}
                />
              </div>
            </div>

            {/* Passengers can leave without affecting the shared route. Hosts end it from Host controls. */}
            {!isHost && (
              <div className="pt-4 border-t border-[#D8D8D2]/30 text-center">
                <button
                  onClick={handleLeaveTrip}
                  className="font-mono text-xs opacity-70 hover:text-[#EF6245] flex items-center gap-1.5 mx-auto uppercase tracking-wider transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> LEAVE THE ROUTE
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#D8D8D2]/30 bg-white/5 p-4 text-center font-mono text-[10px] opacity-70 uppercase tracking-widest shadow-sm">
        TRIPTUNE · THE ROAD MAP FOR YOUR MUSIC · FAIR QUEUE FOR THE JOURNEY
      </footer>
    </div>
  )
}

export default App
