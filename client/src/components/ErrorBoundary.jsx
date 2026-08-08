import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('TRIPTUNE RUNTIME ERROR CAUGHT:', error, errorInfo)
  }

  handleReset = () => {
    try {
      localStorage.removeItem('triptune_active_trip')
      localStorage.removeItem('triptune_user')
    } catch (e) {}
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#11161A] text-[#F3EFE6] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#11161A] border border-[#D97861]/40 rounded-lg p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#D97861]/20 border border-[#D97861]/40 flex items-center justify-center mx-auto text-[#D97861]">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-lg text-[#F3EFE6] uppercase tracking-wider">
                SOMETHING WENT WRONG
              </h2>
              <p className="font-sans text-xs text-[#A8AAA5]">
                {this.state.error?.message || 'A transient rendering error occurred.'}
              </p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-[#F2B84B] hover:bg-[#E5A93C] text-[#11161A] font-heading font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              RESET APPLICATION & GO HOME
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
