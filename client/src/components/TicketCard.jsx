import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, QrCode, ArrowRight } from 'lucide-react'

function TicketCard({ trip, joinCode, routeName = 'PICT → GOA', busNo = 'BUS 02' }) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const codeToUse = trip?.joinCode || joinCode || 'GOA247'
  const tripTitle = trip?.name || 'PICT → GOA'
  const host = trip?.hostName || 'Host'
  const joinUrl = `${window.location.origin}?code=${codeToUse}`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeToUse)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-white text-[#17191B] rounded-md border border-[#D8D8D2] shadow-sm overflow-hidden font-sans">
      {/* Route Header */}
      <div className="p-4 border-b border-[#D8D8D2] bg-[#F7F5EF] flex justify-between items-center">
        <div>
          <span className="font-mono text-[10px] font-bold text-[#2457D6] uppercase tracking-widest block">
            ROUTE MARKER PASS
          </span>
          <span className="font-heading font-extrabold text-base text-[#17191B]">
            JOIN THIS ROUTE
          </span>
        </div>
        <span className="font-mono text-xs text-[#72767A]">{busNo}</span>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Route Visual Line */}
        <div className="flex items-center justify-between text-xs font-mono font-bold text-[#17191B]">
          <span>PICT</span>
          <div className="flex-1 mx-3 flex items-center">
            <div className="w-2 h-2 rounded-full bg-[#2457D6]" />
            <div className="flex-1 h-[2px] bg-[#2457D6]" />
            <div className="w-2 h-2 rounded-full bg-[#2457D6]" />
          </div>
          <span>GOA</span>
        </div>

        {/* QR Code Frame */}
        <div className="flex flex-col items-center justify-center p-4 bg-[#F7F5EF] rounded border border-[#D8D8D2]">
          <div className="bg-white p-2.5 rounded border border-[#D8D8D2]">
            <QRCodeSVG value={joinUrl} size={140} fgColor="#17191B" bgColor="#FFFFFF" level="M" />
          </div>
          <span className="font-mono text-[11px] text-[#72767A] font-semibold mt-2.5 flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-[#2457D6]" />
            SCAN TO JOIN ROUTE
          </span>
        </div>

        {/* Join Code */}
        <div className="text-center space-y-1">
          <span className="font-mono text-[10px] text-[#72767A] uppercase tracking-widest font-semibold block">
            6-CHARACTER ROUTE CODE
          </span>
          <div className="font-mono text-3xl font-extrabold tracking-[0.2em] text-[#17191B] bg-[#F7F5EF] py-2 rounded border border-[#D8D8D2]">
            {codeToUse}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCopyCode}
            className="py-2.5 px-3 bg-[#2457D6] hover:bg-[#1D46B0] text-white font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? 'COPIED!' : 'COPY CODE'}
          </button>

          <button
            onClick={handleCopyLink}
            className="py-2.5 px-3 bg-[#F7F5EF] hover:bg-[#D8D8D2]/40 text-[#17191B] border border-[#D8D8D2] font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#2457D6]" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? 'LINK COPIED' : 'COPY LINK'}
          </button>
        </div>
      </div>

      <div className="p-2.5 bg-[#F7F5EF] border-t border-[#D8D8D2] text-center font-mono text-[9px] text-[#72767A]">
        TRIPTUNE · THE ROAD MAP FOR YOUR MUSIC
      </div>
    </div>
  )
}

export default TicketCard
