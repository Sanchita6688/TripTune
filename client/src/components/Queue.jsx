import QueueItem from './QueueItem'

function Queue({ queue = [], currentUserId, isHost, onRemoveSong }) {
  const safeQueue = Array.isArray(queue) ? queue : []
  const songCountFormatted = String(safeQueue.length).padStart(2, '0') + ' SONGS'

  return (
    <div className="bg-white border border-[#D8D8D2] rounded-md p-5 space-y-3 shadow-sm font-sans">
      {/* Route Ahead Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#D8D8D2]">
        <h3 className="font-heading font-extrabold text-sm text-[#17191B] uppercase tracking-wider flex items-center gap-2">
          <span>ROUTE AHEAD</span>
        </h3>
        <span className="font-mono text-xs font-bold text-[#2457D6]">
          {songCountFormatted}
        </span>
      </div>

      {safeQueue.length === 0 ? (
        <div className="py-8 text-center bg-[#F7F5EF] rounded border border-[#D8D8D2] space-y-1">
          <p className="font-heading font-bold text-xs text-[#17191B] uppercase tracking-wider">THE ROUTE AHEAD IS EMPTY.</p>
          <p className="font-sans text-xs text-[#72767A]">Select a song for the next stop.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#D8D8D2] max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {safeQueue.map((song, index) => (
            <QueueItem
              key={song._id || (song.providerId + index)}
              song={song}
              position={index + 1}
              currentUserId={currentUserId}
              isHost={isHost}
              onRemoveSong={onRemoveSong}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Queue
