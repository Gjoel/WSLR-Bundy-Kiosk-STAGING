import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function EmployeeCard({ employee, status, onStatusChange, lastEntry }) {
  const [busy, setBusy] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState(status)
  const [showSuccess, setShowSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  // Update optimistic status when actual status changes
  useEffect(() => {
    setOptimisticStatus(status)
  }, [status])

  const handleClockInOut = async () => {
    if (busy || cooldown) return

    setBusy(true)
    const newDirection = optimisticStatus === 'in' ? 'out' : 'in'
    
    // Optimistic update - change UI immediately
    setOptimisticStatus(newDirection)
    
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: employee.id,
          direction: newDirection,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      // Success! Show feedback
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)

      // Cooldown period to prevent rapid clicks
      setCooldown(true)
      setTimeout(() => setCooldown(false), 2000)

      // Refresh data in background
      onStatusChange()
    } catch (error) {
      console.error('Error clocking in/out:', error)
      
      // Revert optimistic update on error
      setOptimisticStatus(status)
      alert('Failed to clock in/out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const isIn = optimisticStatus === 'in'

  const formatLastEntry = () => {
    if (!lastEntry) return null
    const date = new Date(lastEntry)
    const time = date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    
    return isToday ? `Last action: ${time}` : `Last action: ${date.toLocaleDateString('en-AU')} ${time}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col relative">
      {/* Success overlay */}
      {showSuccess && (
        <div className="absolute inset-0 bg-green-500 bg-opacity-90 rounded-2xl flex items-center justify-center z-10 animate-pulse">
          <div className="text-white text-center">
            <div className="text-4xl mb-2">✓</div>
            <div className="text-lg font-semibold">
              {isIn ? 'Clocked In!' : 'Clocked Out!'}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-900">{employee.name}</h3>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${
          isIn ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {isIn ? 'Clocked In' : 'Clocked Out'}
        </span>
      </div>

      {/* Last action time */}
      {lastEntry && (
        <p className="text-xs text-gray-500 mb-4">{formatLastEntry()}</p>
      )}
      
      <button
        onClick={handleClockInOut}
        disabled={busy || cooldown}
        className={`w-full py-4 rounded-xl text-white text-lg font-semibold transition-all ${
          isIn 
            ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' 
            : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
        } disabled:opacity-50 disabled:cursor-not-allowed ${
          busy ? 'animate-pulse' : ''
        }`}
      >
        {busy ? 'Processing...' : cooldown ? 'Please wait...' : (isIn ? 'Clock Out' : 'Clock In')}
      </button>
    </div>
  )
}