function TurnBalance({ members = [], queue = [] }) {
  const safeMembers = Array.isArray(members) ? members : []
  const safeQueue = Array.isArray(queue) ? queue : []

  if (safeMembers.length === 0) return null

  // Calculate pending counts per user safely
  const userCounts = safeMembers.map(m => {
    const displayName = typeof m === 'string' ? m : (m?.displayName || 'Passenger')
    const userId = typeof m === 'object' ? (m?.userId || m?._id) : null

    const pending = safeQueue.filter(s => {
      if (s.userDisplayName && s.userDisplayName === displayName) return true
      if (userId && s.userId && s.userId.toString() === userId.toString()) return true
      return false
    }).length

    const played = typeof m === 'object' ? (m?.songsPlayed || 0) : 0
    return {
      displayName,
      played,
      pending
    }
  })

  return (
    <div className="bg-white border border-[#D8D8D2] rounded-md p-4 space-y-3 shadow-sm font-sans">
      <div className="flex justify-between items-center pb-2 border-b border-[#D8D8D2]">
        <h3 className="font-heading font-extrabold text-xs text-[#17191B] uppercase tracking-wider">
          WHO'S NEXT? ⚖️
        </h3>
        <span className="font-mono text-[10px] text-[#72767A]">TURN ORDER BALANCED</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
        {userCounts.map(u => (
          <div key={u.displayName} className="flex justify-between items-center p-2.5 bg-[#F7F5EF] border border-[#D8D8D2] rounded">
            <span className="text-[#17191B] font-semibold truncate max-w-[110px]">{u.displayName}</span>
            <div className="flex items-center gap-1.5 text-[#2457D6]">
              <span className="text-[10px] text-[#72767A]">─────</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#2457D6]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TurnBalance
