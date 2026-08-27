import { useState } from 'react'
import { Search, X, Loader2, ArrowRight } from 'lucide-react'

function SearchBar({ onSearch, isSearching }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!query.trim() || isSearching) return
    onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex gap-2 font-sans">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a song, artist, or mood…"
          disabled={isSearching}
          aria-label="Search YouTube"
          className="w-full px-4 py-3 bg-white border border-[#D8D8D2] rounded text-[#17191B] placeholder-[#72767A] focus:outline-none focus:border-[#2457D6] disabled:opacity-60 transition-colors text-sm"
        />
        {query && !isSearching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#72767A] hover:text-[#17191B] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={!query.trim() || isSearching}
        className="px-5 py-3 bg-[#2457D6] hover:bg-[#1D46B0] disabled:opacity-50 text-white font-mono font-bold text-xs tracking-wider uppercase rounded transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        {isSearching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            SEARCHING...
          </>
        ) : (
          <>
            SEARCH <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}

export default SearchBar
