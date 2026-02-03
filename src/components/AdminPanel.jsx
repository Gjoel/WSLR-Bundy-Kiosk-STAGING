import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function AdminPanel({ onLock, onBackToKiosk }) {
  const [employees, setEmployees] = useState([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [renameEmployee, setRenameEmployee] = useState(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadEmployees()
  }, [showInactive])

  const loadEmployees = async () => {
    try {
      let query = supabase
        .from('employees')
        .select('*')
        .eq('org_id', import.meta.env.VITE_ORG_ID)
        .order('name')

      if (!showInactive) {
        query = query.eq('active', true).is('deleted_at', null)
      }

      const { data, error } = await query

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmployee = async (e) => {
    e.preventDefault()
    const trimmedName = newEmployeeName.trim()
    
    if (!trimmedName) {
      alert('Please enter a name')
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .insert({
          org_id: import.meta.env.VITE_ORG_ID,
          name: trimmedName,
          active: true
        })

      if (error) throw error

      setNewEmployeeName('')
      loadEmployees()
    } catch (error) {
      console.error('Error adding employee:', error)
      alert('Failed to add employee')
    }
  }

  const handleRename = async (employeeId) => {
    const trimmedName = newName.trim()
    
    if (!trimmedName) {
      alert('Please enter a name')
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .update({ name: trimmedName, updated_at: new Date().toISOString() })
        .eq('id', employeeId)

      if (error) throw error

      setRenameEmployee(null)
      setNewName('')
      loadEmployees()
    } catch (error) {
      console.error('Error renaming employee:', error)
      alert('Failed to rename employee')
    }
  }

  const handleDeactivate = async (employeeId, currentlyActive) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ active: !currentlyActive, updated_at: new Date().toISOString() })
        .eq('id', employeeId)

      if (error) throw error
      loadEmployees()
    } catch (error) {
      console.error('Error deactivating employee:', error)
      alert('Failed to update employee status')
    }
  }

  const handleDelete = async (employeeId) => {
    if (!confirm('Are you sure you want to delete this employee? This will also delete all their time entries.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeId)

      if (error) throw error
      loadEmployees()
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Failed to delete employee')
    }
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      let imported = 0
      let errors = 0

      for (const line of lines.slice(1)) { // Skip header
        const name = line.trim()
        if (!name) continue

        try {
          const { error } = await supabase
            .from('employees')
            .insert({
              org_id: import.meta.env.VITE_ORG_ID,
              name: name,
              active: true
            })

          if (error) {
            errors++
            console.error('Error importing:', name, error)
          } else {
            imported++
          }
        } catch (err) {
          errors++
        }
      }

      setImportStatus(`Imported: total ${imported}, errors ${errors}`)
      loadEmployees()
    } catch (error) {
      console.error('Error reading CSV:', error)
      setImportStatus('Failed to read CSV file')
    }

    e.target.value = ''
  }

  const handleExportCSV = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select start and end dates')
      return
    }

    try {
      // Get all active employees (sorted alphabetically)
      const { data: activeEmployees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('org_id', import.meta.env.VITE_ORG_ID)
        .eq('active', true)
        .is('deleted_at', null)
        .order('name')

      if (empError) throw empError

      // Handle date range with proper timezone
      const startDate = new Date(exportStartDate + 'T00:00:00')
      const endDate = new Date(exportEndDate + 'T23:59:59')

      // Collect all data organized by employee and date
      const allDatesSet = new Set()
      const employeeDataByDate = []
      
      for (const emp of activeEmployees) {
        const { data: entries, error: entriesError } = await supabase
          .from('time_entries')
          .select('*')
          .eq('employee_id', emp.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at')

        if (entriesError) throw entriesError

        const pairsByDate = {}
        
        // Group pairs by date
        for (let i = 0; i < entries.length; i += 2) {
          if (entries[i] && entries[i].direction === 'in') {
            const date = new Date(entries[i].created_at)
            const dateKey = date.toLocaleDateString('en-AU', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            })
            
            allDatesSet.add(dateKey)
            
            if (!pairsByDate[dateKey]) pairsByDate[dateKey] = []
            
            const startTime = new Date(entries[i].created_at)
            const startStr = startTime.toLocaleTimeString('en-AU', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }).replace(':', '')

            let finishStr = ''
            if (entries[i + 1] && entries[i + 1].direction === 'out') {
              const finishTime = new Date(entries[i + 1].created_at)
              finishStr = finishTime.toLocaleTimeString('en-AU', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              }).replace(':', '')
            }
            
            pairsByDate[dateKey].push([startStr, finishStr])
          }
        }

        employeeDataByDate.push({ name: emp.name, pairsByDate })
      }

      // Sort all dates
      const allDates = Array.from(allDatesSet).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/')
        const [dayB, monthB, yearB] = b.split('/')
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB)
      })

      // Find max pairs for each date across all employees
      const maxPairsByDate = {}
      allDates.forEach(date => {
        maxPairsByDate[date] = Math.max(
          ...employeeDataByDate.map(emp => (emp.pairsByDate[date] || []).length),
          0
        )
      })

      // Build headers
      const dateHeader = ['employee_name']
      const inOutHeader = ['']
      
      allDates.forEach(date => {
        const pairCount = maxPairsByDate[date]
        for (let i = 0; i < pairCount; i++) {
          dateHeader.push(date, '')
          inOutHeader.push('In', 'Out')
        }
      })

      // Build data rows
      const csvData = employeeDataByDate.map(emp => {
        const row = [emp.name]
        
        allDates.forEach(date => {
          const pairs = emp.pairsByDate[date] || []
          const maxForDate = maxPairsByDate[date]
          
          // Add this employee's pairs for this date
          pairs.forEach(pair => {
            row.push(...pair)
          })
          
          // Pad with empty cells if this employee has fewer pairs than max
          const remaining = maxForDate - pairs.length
          for (let i = 0; i < remaining; i++) {
            row.push('', '')
          }
        })
        
        return row
      })

      // Generate CSV
      const csv = [
        dateHeader.join(','),
        inOutHeader.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n')

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bundy-export-${exportStartDate}-to-${exportEndDate}.csv`
      a.click()
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV')
    }
  }

  const downloadTemplate = () => {
    const csv = 'name\nJohn Smith\nJane Doe'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <div className="flex gap-3">
            <button
              onClick={onBackToKiosk}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Kiosk
            </button>
            <button
              onClick={onLock}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Lock Admin
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">Show inactive / deleted</span>
            </label>
            <button
              onClick={loadEmployees}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>

          {/* Add Employee */}
          <form onSubmit={handleAddEmployee} className="flex gap-3 mb-6">
            <input
              type="text"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              placeholder="New employee name"
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add Person
            </button>
          </form>

          {/* CSV Import */}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="text-sm"
            />
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
            >
              Download Template
            </button>
          </div>
          {importStatus && (
            <p className="text-sm text-gray-600 mb-4">{importStatus}</p>
          )}

          {/* CSV Export */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Export Report</h3>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
              <span>to</span>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
              <button
                onClick={handleExportCSV}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{emp.name}</div>
                    <div className="text-xs text-gray-500">ID: {emp.id.substring(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                      emp.active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {emp.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRenameEmployee(emp.id)
                          setNewName(emp.name)
                        }}
                        className="px-3 py-1 border rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeactivate(emp.id, emp.active)}
                        className="px-3 py-1 border rounded-lg hover:bg-gray-50 text-sm"
                      >
                        {emp.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {employees.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No employees to display
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {renameEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Rename Employee</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRenameEmployee(null)
                  setNewName('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRename(renameEmployee)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}