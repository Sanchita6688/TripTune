import { useState } from 'react'
import { ArrowRight, Check, Loader2, Lock } from 'lucide-react'

function SongSearchResult({ song, onAddSong, queueLocked }) {
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const handleAdd = async () => {
    if (isAdding || isAdded || queueLocked) return
    setIsAdding(true)
    setErrorMsg(null)
    try {
      await onAddSong(song)
      setIsAdded(true)
      setTimeout(() => setIsAdded(false), 3000)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add song')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-white border border-[#D8D8D2] rounded transition-colors hover:border-[#2457D6]/40">
      {/* Thumbnail */}
      <div className="relative w-full sm:w-24 h-18 sm:h-14 flex-shrink-0 overflow-hidden rounded bg-[#F7F5EF] border border-[#D8D8D2]">
        {song.thumbnail ? (
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#72767A] font-mono text-xs">
            AUDIO
          </div>
        )}
        {song.duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-[#17191B]/80 text-[10px] font-mono text-white rounded">
            {song.duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <h4 className="text-xs font-heading font-bold text-[#17191B] truncate" title={song.title}>
          {song.title}
        </h4>
        <p className="text-[11px] font-sans text-[#72767A] truncate mt-0.5" title={song.channel}>
          {song.channel}
        </p>

        {errorMsg && (
          <p className="text-[11px] font-sans text-[#EF6245] mt-1 font-semibold">
            ⚠️ {errorMsg}
          </p>
        )}
      </div>

      {/* Add Button */}
      <button
        onClick={handleAdd}
        disabled={isAdding || isAdded || queueLocked}
        className={`w-full sm:w-auto px-4 py-2 font-mono font-bold text-xs tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
          isAdded
            ? 'bg-[#48A868] text-white cursor-default'
            : isAdding
            ? 'bg-[#2457D6]/40 text-white cursor-wait'
            : queueLocked
            ? 'bg-[#D8D8D2] text-[#72767A] cursor-not-allowed'
            : 'bg-[#2457D6] hover:bg-[#1D46B0] text-white'
        }`}
      >
        {isAdding ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ADDING...
          </>
        ) : isAdded ? (
          <>
            <Check className="w-3.5 h-3.5" />
            ✓ ADDED TO QUEUE
          </>
        ) : queueLocked ? (
          <>
            <Lock className="w-3.5 h-3.5" />
            LOCKED
          </>
        ) : (
          <>
            ADD <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </div>
  )
}

export default SongSearchResult
