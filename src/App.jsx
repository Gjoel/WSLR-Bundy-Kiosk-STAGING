import { useState, useEffect } from 'react'
import Kiosk from './components/Kiosk'
import AdminPanel from './components/AdminPanel'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [passcodeInput, setPasscodeInput] = useState('')
  const [error, setError] = useState('')

  const handleUnlock = (e) => {
    e.preventDefault()
    if (passcodeInput === import.meta.env.VITE_ADMIN_PASSCODE) {
      setIsLocked(false)
      setError('')
      setPasscodeInput('')
    } else {
      setError('Incorrect passcode')
      setPasscodeInput('')
    }
  }

  const handleLock = () => {
    setIsLocked(true)
    setIsAdmin(false)
  }

  if (isLocked) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">WSLR Bundy Kiosk</h1>
          <form onSubmit={handleUnlock}>
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Enter admin passcode"
              className="w-full px-4 py-3 border rounded-lg mb-4 text-lg"
              autoFocus
            />
            {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 rounded-lg text-lg font-medium hover:bg-gray-800"
            >
              Unlock Admin
            </button>
          </form>
          <button
            onClick={() => {
              setIsLocked(false)
              setIsAdmin(false)
            }}
            className="w-full mt-4 bg-gray-200 text-gray-900 py-3 rounded-lg text-lg font-medium hover:bg-gray-300"
          >
            Go to Kiosk
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {isAdmin ? (
        <AdminPanel onLock={handleLock} onBackToKiosk={() => setIsAdmin(false)} />
      ) : (
        <Kiosk onAdminClick={() => setIsAdmin(true)} />
      )}
    </div>
  )
}

export default App