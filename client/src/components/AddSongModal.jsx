import { useState } from 'react'
import SearchBar from './SearchBar'
import SearchResults from './SearchResults'
import { searchYouTube } from '../services/youtube'
import { Lock, AlertCircle } from 'lucide-react'

function AddSongModal({ onAddSong, queueLocked, pendingCount = 0, maxPending = 3 }) {
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const handleSearch = async (query) => {
    setIsSearching(true)
    setSearchError(null)
    try {
      const data = await searchYouTube(query)
      setResults(data)
      setHasSearched(true)
    } catch (err) {
      console.error('Search error:', err)
      setSearchError(err.response?.data?.message || 'Unable to search right now. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const isLimitReached = pendingCount >= maxPending

  return (
    <div className="bg-white/5 border border-[#D8D8D2]/30 rounded-md p-5 space-y-4 shadow-sm font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[#D8D8D2]/30 pb-3">
        <div>
          <h3 className="font-heading font-extrabold text-base uppercase tracking-wider text-[#2457D6]">
            ＋ ADD A SONG
          </h3>
          <p className="font-sans text-xs opacity-75 mt-0.5">Search YouTube & add tracks for the route</p>
        </div>

        <span className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider self-start sm:self-auto ${
          isLimitReached 
            ? 'bg-[#EF6245]/10 text-[#EF6245] border-[#EF6245]/30'
            : 'bg-[#2457D6]/10 text-[#2457D6] border-[#2457D6]/30'
        }`}>
          PENDING: {pendingCount}/{maxPending}
        </span>
      </div>

      {/* Warnings */}
      {isLimitReached && (
        <div className="p-3 bg-[#EF6245]/10 border border-[#EF6245]/30 text-[#EF6245] rounded text-xs flex items-center gap-2 font-sans">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>You have reached your {maxPending} pending song limit. Wait until your song plays!</span>
        </div>
      )}

      {queueLocked && (
        <div className="p-3 bg-[#EF6245]/10 border border-[#EF6245]/30 text-[#EF6245] rounded text-xs flex items-center gap-2 font-sans">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Song requests are currently paused by the host.</span>
        </div>
      )}

      {/* Direct Search Input Box - Always Open */}
      <div className="space-y-4">
        <SearchBar onSearch={handleSearch} isSearching={isSearching} />

        <SearchResults
          results={results}
          isSearching={isSearching}
          hasSearched={hasSearched}
          searchError={searchError}
          onAddSong={onAddSong}
          queueLocked={queueLocked || isLimitReached}
        />
      </div>
    </div>
  )
}

export default AddSongModal
