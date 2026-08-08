import { Play, Pause, SkipForward, Lock, Unlock, OctagonX } from 'lucide-react'

function HostControls({ isPlaying, queueLocked, onPlayToggle, onSkip, onLockToggle, onEndTrip }) {
  return (
    <div className="bg-white border border-[#D8D8D2] rounded-md p-4 space-y-3 shadow-sm font-sans">
      <div className="flex justify-between items-center pb-2 border-b border-[#D8D8D2]">
        <h3 className="font-heading font-extrabold text-xs text-[#2457D6] uppercase tracking-wider flex items-center gap-1.5">
          <span>HOST MODE</span>
        </h3>
        <span className="font-mono text-[10px] text-[#72767A] uppercase">PLAYBACK CONTROLLER</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Play/Pause */}
        <button
          onClick={onPlayToggle}
          className="py-2.5 px-3 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" /> PAUSE
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" /> ▶ PLAY
            </>
          )}
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          className="py-2.5 px-3 bg-white hover:bg-[#F7F5EF] text-[#17191B] border border-[#D8D8D2] font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
        >
          <SkipForward className="w-3.5 h-3.5" /> → SKIP
        </button>

        {/* Lock/Unlock Queue */}
        <button
          onClick={onLockToggle}
          className={`py-2.5 px-3 font-mono font-bold text-xs uppercase tracking-wider rounded border transition-colors flex items-center justify-center gap-1.5 ${
            queueLocked
              ? 'bg-[#FDECE8] text-[#EF6245] border-[#EF6245]/30'
              : 'bg-white text-[#17191B] border-[#D8D8D2] hover:bg-[#F7F5EF]'
          }`}
        >
          {queueLocked ? (
            <>
              <Unlock className="w-3.5 h-3.5" /> UNLOCK QUEUE
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" /> LOCK QUEUE
            </>
          )}
        </button>

        {/* End Trip */}
        <button
          onClick={onEndTrip}
          className="py-2.5 px-3 bg-white hover:bg-[#FDECE8] text-[#EF6245] border border-[#EF6245]/30 font-mono font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
        >
          <OctagonX className="w-3.5 h-3.5" /> END TRIP
        </button>
      </div>
    </div>
  )
}

export default HostControls
