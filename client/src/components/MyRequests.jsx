import { useEffect, useState } from 'react'
import { getUserRequests } from '../services/youtube'
import { RotateCw } from 'lucide-react'

function MyRequests({ tripId, userId, sessionId, queue = [] }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchMyRequests = async () => {
    if (!tripId || !userId) return
    setLoading(true)
    try {
      const data = await getUserRequests(tripId, userId, sessionId)
      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch my requests error:', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyRequests()
  }, [tripId, userId, sessionId, queue])

  const safeQueue = Array.isArray(queue) ? queue : []
  const safeRequests = Array.isArray(requests) ? requests : []

  const getStatusIndicator = (status, songId) => {
    if (status === 'QUEUED') {
      const posIndex = safeQueue.findIndex(s => s._id === songId)
      const posText = posIndex !== -1 ? `#${String(posIndex + 1).padStart(2, '0')}` : 'QUEUED'
      return (
        <span className="font-mono text-xs font-bold text-[#2457D6]">
          ● {posText} QUEUED
        </span>
      )
    }
    if (status === 'PLAYING') {
      return (
        <span className="font-mono text-xs font-bold text-[#EF6245] animate-pulse">
          ● CURRENT STOP
        </span>
      )
    }
    if (status === 'PLAYED') {
      return (
        <span className="font-mono text-xs font-semibold text-[#48A868]">
          ● PLAYED
        </span>
      )
    }
    if (status === 'SKIPPED') {
      return (
        <span className="font-mono text-xs font-semibold text-[#EF6245]">
          ● SKIPPED
        </span>
      )
    }
    if (status === 'REMOVED') {
      return (
        <span className="font-mono text-xs font-semibold text-[#72767A]">
          ● REMOVED
        </span>
      )
    }
    return null
  }

  return (
    <div className="bg-white border border-[#D8D8D2] rounded-md p-5 space-y-3 shadow-sm font-sans">
      <div className="flex justify-between items-center pb-2 border-b border-[#D8D8D2]">
        <h3 className="font-heading font-extrabold text-sm text-[#17191B] uppercase tracking-wider flex items-center gap-2">
          <span>YOUR REQUESTS</span>
        </h3>
        <button
          onClick={fetchMyRequests}
          className="text-[#72767A] hover:text-[#17191B] text-xs font-mono flex items-center gap-1"
        >
          <RotateCw className="w-3 h-3" /> REFRESH
        </button>
      </div>

      {loading && safeRequests.length === 0 ? (
        <p className="font-mono text-xs text-[#72767A] text-center py-4">LOADING REQUEST HISTORY...</p>
      ) : safeRequests.length === 0 ? (
        <p className="font-sans text-xs text-[#72767A] text-center py-4">
          NO REQUESTS YET. Pick a track for the journey.
        </p>
      ) : (
        <div className="divide-y divide-[#D8D8D2] max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {safeRequests.map((song) => (
            <div
              key={song._id || song.providerId}
              className="flex items-center justify-between gap-3 py-2.5 px-1 text-xs"
            >
              <div className="min-w-0 flex-1">
                <h4 className="font-heading font-bold text-xs text-[#17191B] truncate" title={song.title}>
                  {song.title}
                </h4>
                <p className="font-sans text-[11px] text-[#72767A] truncate">{song.artistOrChannel}</p>
              </div>

              <div className="flex-shrink-0 text-right">
                {getStatusIndicator(song.status, song._id)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyRequests
