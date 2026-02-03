import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import EmployeeCard from './EmployeeCard'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Kiosk({ onAdminClick }) {
  const [employees, setEmployees] = useState([])
  const [statuses, setStatuses] = useState({})
  const [lastEntries, setLastEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [lastAutoClockoutDate, setLastAutoClockoutDate] = useState(
    localStorage.getItem('lastAutoClockoutDate') || ''
  )

  useEffect(() => {
    loadEmployees()
  }, [])

  const checkAutoClockout = useCallback(async (now) => {
    // Get Sydney time
    const sydneyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
    const hour = sydneyTime.getHours()
    const minute = sydneyTime.getMinutes()
    const todayDate = sydneyTime.toDateString()
    
    // Check if it's 11:00 PM and we haven't run today
    if (hour === 23 && minute === 0 && lastAutoClockoutDate !== todayDate) {
      console.log('Running auto clock-out at 11 PM...')
      
      try {
        // Get all employees who are currently clocked in
        const clockedInEmployees = employees.filter(emp => statuses[emp.id] === 'in')
        
        if (clockedInEmployees.length === 0) {
          console.log('No employees to clock out')
          localStorage.setItem('lastAutoClockoutDate', todayDate)
          setLastAutoClockoutDate(todayDate)
          return
        }
        
        // Clock them all out
        let clockedOutCount = 0
        for (const emp of clockedInEmployees) {
          const { error } = await supabase
            .from('time_entries')
            .insert({
              employee_id: emp.id,
              direction: 'out',
              created_at: new Date().toISOString()
            })
          
          if (!error) {
            clockedOutCount++
          }
        }
        
        console.log(`Auto-clocked out ${clockedOutCount} employees at 11 PM`)
        
        // Save today's date so we don't run again
        localStorage.setItem('lastAutoClockoutDate', todayDate)
        setLastAutoClockoutDate(todayDate)
        
        // Refresh the employee list to update UI
        setTimeout(() => loadEmployees(), 1000)
      } catch (error) {
        console.error('Auto clock-out error:', error)
      }
    }
  }, [employees, statuses, lastAutoClockoutDate])

  useEffect(() => {
    // Update time every second and check for auto clock-out
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      checkAutoClockout(now)
    }, 1000)

    return () => clearInterval(timer)
  }, [checkAutoClockout])

  const loadEmployees = async () => {
    try {
      // Load active employees
      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('org_id', import.meta.env.VITE_ORG_ID)
        .eq('active', true)
        .is('deleted_at', null)
        .order('name')

      if (empError) throw empError

      // Get all employee IDs
      const employeeIds = employeesData.map(emp => emp.id)

      // Load ALL latest time entries in one query
      const { data: allEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select('*')
        .in('employee_id', employeeIds)
        .order('created_at', { ascending: false })

      if (entriesError) throw entriesError

      // Process entries to find latest for each employee
      const statusMap = {}
      const lastEntryMap = {}
      
      // Group entries by employee and keep only the latest
      employeesData.forEach(emp => {
        const empEntries = allEntries.filter(entry => entry.employee_id === emp.id)
        
        if (empEntries.length > 0) {
          statusMap[emp.id] = empEntries[0].direction
          lastEntryMap[emp.id] = empEntries[0].created_at
        } else {
          statusMap[emp.id] = 'out'
          lastEntryMap[emp.id] = null
        }
      })

      setEmployees(employeesData)
      setStatuses(statusMap)
      setLastEntries(lastEntryMap)
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Filter employees based on search term
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WSLR Bundy Kiosk</h1>
            <p className="text-sm text-gray-600">{formatDate(currentTime)}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{formatTime(currentTime)}</div>
            <button
              onClick={onAdminClick}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              Admin Panel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search for your name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-center text-sm text-gray-600 mt-2">
              Showing {filteredEmployees.length} of {employees.length} employees
            </p>
          )}
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No active employees</p>
            <p className="text-sm text-gray-500 mt-2">Add employees in the Admin Panel</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No employees found</p>
            <p className="text-sm text-gray-500 mt-2">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                status={statuses[employee.id] || 'out'}
                lastEntry={lastEntries[employee.id]}
                onStatusChange={loadEmployees}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}