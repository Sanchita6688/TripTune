import { Trash2 } from 'lucide-react'

function QueueItem({ song, position, currentUserId, isHost, onRemoveSong }) {
  const isOriginalRequester = song.userId === currentUserId || (song.userId && song.userId.toString() === currentUserId?.toString())
  const canRemove = isHost || isOriginalRequester
  const posFormatted = String(position).padStart(2, '0')

  return (
    <div className="flex items-center gap-3 p-3 bg-white hover:bg-[#F7F5EF] border-b border-[#D8D8D2] transition-colors group">
      {/* Position Number */}
      <span className="font-mono font-bold text-sm text-[#17191B] w-6 flex-shrink-0">
        {posFormatted}
      </span>

      {/* Route Marker Line Indicator */}
      <div className="flex items-center gap-1 flex-shrink-0 text-[#2457D6]">
        <div className="w-2 h-2 rounded-full bg-[#2457D6]" />
        <div className="w-4 h-[2px] bg-[#2457D6]" />
      </div>

      {/* Thumbnail */}
      <div className="relative w-12 h-9 rounded overflow-hidden bg-[#F7F5EF] border border-[#D8D8D2] flex-shrink-0">
        {song.thumbnail ? (
          <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-[#72767A]">🎵</div>
        )}
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <h4 className="font-heading font-bold text-xs text-[#17191B] truncate" title={song.title}>
          {song.title}
        </h4>
        <p className="font-sans text-[11px] text-[#72767A] truncate">
          {song.artistOrChannel}
        </p>
      </div>

      {/* Requester Tag in Mono */}
      <div className="text-right flex-shrink-0 min-w-0 max-w-[110px]">
        <div className="font-mono text-[10px] font-bold text-[#2457D6] truncate uppercase">
          {song.userDisplayName}
        </div>
        {song.duration && (
          <div className="font-mono text-[9px] text-[#72767A]">
            {song.duration}
          </div>
        )}
      </div>

      {/* Action */}
      {canRemove && (
        <button
          onClick={() => onRemoveSong(song._id)}
          title="Remove from queue"
          aria-label={`Remove ${song.title} from queue`}
          className="opacity-60 group-hover:opacity-100 p-1.5 text-[#72767A] hover:text-[#EF6245] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export default QueueItem
