import { useEffect, useState, useRef } from 'react'
import { Disc, Radio, Volume2, VolumeX } from 'lucide-react'

function NowPlaying({ currentSong, isHost, isPlaying, onSongEnded, onPlayToggle, onSkip }) {
  const [playLocalAudio, setPlayLocalAudio] = useState(isHost)
  const currentVideoId = currentSong?.providerId
  const lastEndedIdRef = useRef(null)

  // Keep playLocalAudio synced if host status changes
  useEffect(() => {
    if (isHost) {
      setPlayLocalAudio(true)
    }
  }, [isHost])

  // Listen for YouTube IFrame postMessage events (auto-advance on song end)
  useEffect(() => {
    const handleWindowMessage = (event) => {
      if (!event.data) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        
        // YouTube iframe postMessage ENDED state code is info: 0 or event: 'onStateChange', info: 0
        if ((data.event === 'onStateChange' || data.info !== undefined) && (data.info === 0 || data.info === '0')) {
          if (currentSong?._id && lastEndedIdRef.current !== currentSong._id) {
            console.log('🎵 YouTube IFrame: Video Ended naturally! Auto-advancing queue...')
            lastEndedIdRef.current = currentSong._id
            if (onSongEnded) {
              onSongEnded(currentSong._id)
            }
          }
        }
      } catch (e) {}
    }

    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [currentSong?._id, onSongEnded])

  return (
    <div className="bg-white/5 border border-[#D8D8D2]/30 rounded-md p-5 space-y-4 shadow-sm font-sans">
      {/* Indicator Bar */}
      <div className="flex items-center justify-between border-b border-[#D8D8D2]/30 pb-3">
        <span className="font-mono text-xs font-bold text-[#EF6245] tracking-widest uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF6245] animate-pulse" />
          CURRENT STOP
        </span>

        <div className="flex items-center gap-2">
          {!isHost && (
            <button
              onClick={() => setPlayLocalAudio(!playLocalAudio)}
              className="font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-[#2457D6]/40 text-[#2457D6] bg-[#2457D6]/10 hover:bg-[#2457D6]/20 flex items-center gap-1 uppercase transition-colors"
            >
              {playLocalAudio ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              {playLocalAudio ? 'AUDIO ON' : 'AUDIO OFF'}
            </button>
          )}

          <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded border border-[#D8D8D2]/30 uppercase tracking-wider opacity-80">
            {isHost ? 'HOST PLAYER' : 'PASSENGER'}
          </span>
        </div>
      </div>

      {currentSong ? (
        <div className="space-y-4">
          {/* Main YouTube Video Player */}
          {playLocalAudio ? (
            <div className="space-y-3">
              <div className="w-full aspect-video rounded overflow-hidden bg-black border border-[#D8D8D2]/30 relative shadow-md">
                <iframe
                  key={currentVideoId}
                  src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&enablejsapi=1&controls=1&rel=0`}
                  title={currentSong.title || 'YouTube Player'}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 border border-[#D8D8D2]/30 rounded font-mono text-xs">
                <span className="text-[#2457D6] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2457D6] animate-ping" />
                  ▶ YOUTUBE PLAYER ACTIVE
                </span>
                <span className="opacity-70 text-[11px]">Auto-advances when song ends</span>
              </div>
            </div>
          ) : (
            /* Static Display Card for Passengers with Audio OFF */
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white/5 rounded border border-[#D8D8D2]/30">
              <div className="relative w-full sm:w-36 h-28 sm:h-24 rounded overflow-hidden flex-shrink-0 border border-[#D8D8D2]/30 bg-black">
                {currentSong.thumbnail ? (
                  <img
                    src={currentSong.thumbnail}
                    alt={currentSong.title || 'Song'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc className="w-8 h-8 animate-spin text-[#2457D6]" />
                  </div>
                )}
                <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/90 text-[10px] font-mono text-white font-bold rounded">
                  {currentSong.duration || 'N/A'}
                </span>
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                <h3 className="font-heading font-extrabold text-lg truncate" title={currentSong.title}>
                  {currentSong.title}
                </h3>
                <p className="font-sans text-xs opacity-75 font-semibold truncate">
                  {currentSong.artistOrChannel}
                </p>

                <div className="pt-2">
                  <div className="w-full h-1 bg-[#D8D8D2]/30 rounded overflow-hidden">
                    <div className="h-full bg-[#2457D6] w-2/3 animate-pulse" />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 font-mono text-[11px]">
                  <span className="opacity-70">REQUESTED BY:</span>
                  <span className="text-[#2457D6] font-bold">
                    {currentSong.userDisplayName || 'Passenger'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Track Details Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/5 rounded border border-[#D8D8D2]/30 font-mono text-xs opacity-80">
            <div>
              <span className="opacity-70">TRACK: </span>
              <span className="font-bold">{currentSong.title}</span>
            </div>
            <div>
              <span className="opacity-70">REQUESTED BY: </span>
              <span className="text-[#2457D6] font-bold">{currentSong.userDisplayName || 'Passenger'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center bg-white/5 rounded border border-[#D8D8D2]/30 space-y-2">
          <Radio className="w-8 h-8 opacity-60 mx-auto" />
          <p className="font-heading font-extrabold text-sm uppercase tracking-wider">THE ROUTE IS QUIET.</p>
          <p className="font-sans text-xs opacity-70">Be the first to add a song for the journey.</p>
        </div>
      )}
    </div>
  )
}

export default NowPlaying
