import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Local date in YYYY-MM-DD (prevents UTC date shifting)
function toYMDLocal(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const MAX_COMMENT = 200

export default function EmployeeCard({ employee, status, onStatusChange, lastEntry }) {
  const [busy, setBusy] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState(status)
  const [showSuccess, setShowSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  // Comment modal states
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [loadingComment, setLoadingComment] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [commentSavedToast, setCommentSavedToast] = useState(false)

  const workDate = useMemo(() => toYMDLocal(new Date()), [])

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

  const openCommentModal = () => {
    setIsCommentOpen(true)
  }

  const closeCommentModal = () => {
    setIsCommentOpen(false)
    setCommentError('')
  }

  const loadTodaysComment = async () => {
    setLoadingComment(true)
    setCommentError('')

    try {
      const { data, error } = await supabase
        .from('daily_comments')
        .select('comment')
        .eq('employee_id', employee.id)
        .eq('work_date', workDate)
        .maybeSingle()

      if (error) throw error

      setComment(data?.comment ?? '')
    } catch (e) {
      console.error('Error loading comment:', e)
      setCommentError(e?.message || 'Failed to load comment.')
      setComment('')
    } finally {
      setLoadingComment(false)
    }
  }

  const saveTodaysComment = async () => {
    if (savingComment) return

    setSavingComment(true)
    setCommentError('')

    try {
      const trimmed = comment.trim().slice(0, MAX_COMMENT)

      const { error } = await supabase
        .from('daily_comments')
        .upsert(
          {
            employee_id: employee.id,
            work_date: workDate,
            comment: trimmed
          },
          { onConflict: 'employee_id,work_date' }
        )

      if (error) throw error

      setCommentSavedToast(true)
      setTimeout(() => setCommentSavedToast(false), 1600)

      closeCommentModal()
    } catch (e) {
      console.error('Error saving comment:', e)
      setCommentError(e?.message || 'Failed to save comment.')
    } finally {
      setSavingComment(false)
    }
  }

  // When modal opens, load today's comment
  useEffect(() => {
    if (isCommentOpen) {
      loadTodaysComment()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommentOpen])

  const remaining = MAX_COMMENT - comment.length

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col relative">
      {/* Success overlay (clock in/out) */}
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

      {/* Small toast for comment saved */}
      {commentSavedToast && (
        <div className="absolute top-3 right-3 bg-green-600 text-white text-sm px-3 py-2 rounded-xl shadow z-10">
          Comment saved
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-900">{employee.name}</h3>
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${
            isIn ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {isIn ? 'Clocked In' : 'Clocked Out'}
        </span>
      </div>

      {/* Last action time */}
      {lastEntry && (
        <p className="text-xs text-gray-500 mb-4">{formatLastEntry()}</p>
      )}

      {/* Two-button row */}
      <div className="flex gap-3">
        <button
          onClick={handleClockInOut}
          disabled={busy || cooldown}
          className={`flex-1 py-4 rounded-xl text-white text-lg font-semibold transition-all ${
            isIn
              ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
              : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          } disabled:opacity-50 disabled:cursor-not-allowed ${
            busy ? 'animate-pulse' : ''
          }`}
        >
          {busy ? 'Processing...' : cooldown ? 'Please wait...' : (isIn ? 'Clock Out' : 'Clock In')}
        </button>

        <button
          onClick={openCommentModal}
          disabled={savingComment}
          className="flex-1 py-4 rounded-xl text-green-700 text-lg font-semibold transition-all border-2 border-green-500 bg-white hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Comment
        </button>
      </div>

      {/* Comment Modal */}
      {isCommentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCommentModal}
          />

          {/* Modal box */}
          <div className="relative bg-white w-[92%] max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Comment</h4>
                <p className="text-xs text-gray-500">
                  For {workDate} (max {MAX_COMMENT} characters)
                </p>
              </div>

              <button
                onClick={closeCommentModal}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loadingComment ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={MAX_COMMENT}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g. Started 10 mins late due to traffic…"
                />

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">{remaining} left</div>
                  {commentError && (
                    <div className="text-xs text-red-600">{commentError}</div>
                  )}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={closeCommentModal}
                    disabled={savingComment}
                    className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTodaysComment}
                    disabled={savingComment}
                    className="flex-1 py-3 rounded-xl font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingComment ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
