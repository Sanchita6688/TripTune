import SongSearchResult from './SongSearchResult'
import { Loader2 } from 'lucide-react'

function SearchResults({ results = [], isSearching, hasSearched, searchError, onAddSong, queueLocked }) {
  const safeResults = Array.isArray(results) ? results : []

  if (isSearching) {
    return (
      <div className="py-8 text-center text-[#72767A] space-y-2 font-mono text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-[#2457D6] mx-auto" />
        <p className="tracking-wider">SEARCHING YOUTUBE...</p>
      </div>
    )
  }

  if (searchError) {
    return (
      <div className="p-4 bg-white border border-[#EF6245]/40 text-[#17191B] rounded text-center text-xs space-y-1">
        <p className="font-heading font-bold text-[#EF6245] uppercase tracking-wider">SEARCH ERROR</p>
        <p className="font-sans text-[#72767A]">{searchError}</p>
      </div>
    )
  }

  if (hasSearched && safeResults.length === 0) {
    return (
      <div className="py-8 text-center text-[#72767A] bg-white border border-[#D8D8D2] rounded space-y-1">
        <p className="font-heading font-bold text-xs uppercase tracking-wider text-[#17191B]">NO SONGS FOUND</p>
        <p className="font-sans text-xs text-[#72767A]">Try searching for a different track title or artist name.</p>
      </div>
    )
  }

  if (safeResults.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
      <div className="flex justify-between items-center pb-1">
        <span className="font-mono text-[10px] font-bold text-[#72767A] uppercase tracking-widest">
          SEARCH RESULTS ({safeResults.length})
        </span>
        <span className="font-mono text-[10px] text-[#72767A]">SELECT EXACT TRACK</span>
      </div>
      {safeResults.map((song) => (
        <SongSearchResult
          key={song.videoId}
          song={song}
          onAddSong={onAddSong}
          queueLocked={queueLocked}
        />
      ))}
    </div>
  )
}

export default SearchResults
