function Logo({ className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 font-sans ${className}`}>
      {/* Route Marker Icon: Start Dot, Line, End Dot */}
      <div className="relative flex items-center justify-center w-7 h-7 bg-[#2457D6] rounded-sm text-white">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="2.5" fill="currentColor" />
          <line x1="7.5" y1="12" x2="16.5" y2="12" strokeWidth="2.5" />
          <circle cx="19" cy="12" r="2.5" fill="currentColor" />
        </svg>
      </div>

      <div className="flex flex-col leading-none">
        <span className="font-heading font-extrabold text-base tracking-tight text-[#17191B]">
          TRIPTUNE
        </span>
        <span className="font-mono text-[9px] text-[#72767A] tracking-widest mt-0.5 uppercase">
          ROUTE MAP QUEUE
        </span>
      </div>
    </div>
  )
}

export default Logo
