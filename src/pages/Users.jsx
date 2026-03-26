import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Upload, UserPlus, X, ChevronDown, ChevronUp, Eye, EyeOff, AlertCircle } from 'lucide-react'
import SearchInput from '../components/SearchInput'
import SearchableSelect from '../components/SearchableSelect'
import LoadingSpinner from '../components/LoadingSpinner'
import { useEvents } from '../contexts/EventContext'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { LGU_NAMES } from '../data/locations'
import { PROVINCE_NAMES, getCitiesForProvince } from '../data/provinces'
import { validatePassword, hashPassword, getPasswordRules } from '../lib/passwordUtils'
import Button from '../components/Button'
import '../styles/pages/PageStyles.css'
import '../styles/pages/Users.css'

const PAGE_SIZES = [10, 25, 50]

const emptyForm = () => ({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  city: '',
  accountType: '',
  province: '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
  status: 'Active',
})

const MOCK_USERS = [
  { id: '1', first_name: 'John', last_name: 'Smith', email: 'john@example.com', phone: '', city: '', role: 'Admin', status: 'Active', created_at: new Date().toISOString() },
  { id: '2', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@example.com', phone: '', city: '', role: 'Editor', status: 'Active', created_at: new Date().toISOString() },
  { id: '3', first_name: 'Mike', last_name: 'Williams', email: 'mike@example.com', phone: '', city: '', role: 'Viewer', status: 'Active', created_at: new Date().toISOString() },
  { id: '4', first_name: 'Emily', last_name: 'Davis', email: 'emily@example.com', phone: '', city: '', role: 'Editor', status: 'Inactive', created_at: new Date().toISOString() },
]

export default function Users() {
  const { user: currentUser } = useOutletContext() ?? {}
  const { showSuccess, showConfirm, fetchPendingUsersCount } = useEvents()
  const isSuperAdmin = currentUser?.role === 'Super Admin'
  const currentAccountType = currentUser?.account_type || (isSuperAdmin ? 'Super Admin' : '')
  const isRegionalOrSuper = isSuperAdmin || currentAccountType === 'Regional'
  const isProvincial = currentAccountType === 'Provincial'
  const isLgu = currentAccountType === 'LGU'

  // Determine which account types the current user can create
  const allowedAccountTypes = (() => {
    if (currentUser.account_type === 'Regional') return ['Regional', 'Provincial', 'Provincial Approver', 'LGU']
    if (currentUser.account_type === 'Provincial') return ['Provincial', 'Provincial Approver', 'LGU']
    if (isLgu) return ['LGU']
    return []
  })()

  // Whether this user can create accounts at all (has the invite flow)
  const canCreateAccounts = allowedAccountTypes.length > 0
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [viewDetailsUser, setViewDetailsUser] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [tempPasswordResult, setTempPasswordResult] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchUsers = async () => {
    if (!supabase) {
      setUsers(MOCK_USERS)
      setLoading(false)
      return
    }
    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setUsers(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users
    const low = searchTerm.toLowerCase()
    return users.filter((u) =>
      u.first_name?.toLowerCase().includes(low) ||
      u.last_name?.toLowerCase().includes(low) ||
      u.email?.toLowerCase().includes(low) ||
      u.role?.toLowerCase().includes(low)
    )
  }, [users, searchTerm])

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers]
    list.sort((a, b) => {
      let va = a[sortKey]
      let vb = b[sortKey]
      if (sortKey === 'created_at') {
        va = new Date(va || 0).getTime()
        vb = new Date(vb || 0).getTime()
      }
      if (sortKey === 'first_name' || sortKey === 'last_name' || sortKey === 'email') {
        va = String(va || '').toLowerCase()
        vb = String(vb || '').toLowerCase()
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [filteredUsers, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedUsers.slice(start, start + pageSize)
  }, [sortedUsers, currentPage, pageSize])

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const openModal = () => {
    setIsModalOpen(true)
    setForm(emptyForm())
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setForm(emptyForm())
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const openViewDetailsModal = (user) => {
    setViewDetailsUser(user)
  }

  const closeViewDetailsModal = () => {
    setViewDetailsUser(null)
  }

  const openEditModalFromDetails = () => {
    if (!viewDetailsUser) return
    const user = viewDetailsUser
    closeViewDetailsModal()
    openEditModal(user)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setForm({
      email: user.email || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      phone: user.phone || '',
      city: user.city || '',
      accountType: user.account_type || '',
      province: user.province || '',
      currentPassword: '',
      password: '',
      confirmPassword: '',
      status: user.status || 'Active',
    })
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setForm(emptyForm())
    setShowCurrentPassword(false)
    setShowEditPassword(false)
    setShowEditConfirmPassword(false)
    setShowSaveConfirm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      showSuccess('Validation Error', 'Please fill in Email, First Name, and Last Name.')
      return
    }
    // Account type & location validation
    if (!form.accountType) {
      showSuccess('Validation Error', 'Please select an Account type.')
      return
    }
    // Province is required for Provincial and LGU
    if (!form.province) {
      showSuccess('Validation Error', 'Please select a Province.')
      return
    }
    if (form.accountType === 'LGU' && !form.city) {
      showSuccess('Validation Error', 'Please select a City for LGU account.')
      return
    }
    if (supabase) {
      setSubmitting(true)
      try {
        const url = `${supabaseUrl}/functions/v1/create-user-invite`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            account_type: form.accountType || null,
            province: form.province || null,
            city: form.accountType === 'LGU' ? (form.city.trim() || null) : null,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof data?.error === 'string' ? data.error : data?.error?.message || res.statusText || 'Invite failed'
          throw new Error(msg)
        }
        await fetchUsers()
        if (fetchPendingUsersCount) fetchPendingUsersCount()
        setTempPasswordResult({ email: form.email.trim(), emailSent: true })
        closeModal()
      } catch (err) {
        showSuccess('Error', err.message || 'Failed to add user.')
      } finally {
        setSubmitting(false)
      }
    } else {
      alert('Database not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      alert('Please fill in Email, First Name, and Last Name.')
      return
    }
    if (canCreateAccounts) {
      if (!form.accountType) {
        alert('Please select Account type.')
        return
      }
      if (form.accountType !== 'Regional' && !form.province) {
        alert('Please select a Province.')
        return
      }
      if (form.accountType === 'LGU' && !form.city) {
        alert('Please select a City for LGU account.')
        return
      }
    }
    if (form.password || form.confirmPassword) {
      if (!form.currentPassword.trim()) {
        alert('Please enter the current password to change password.')
        return
      }
      const currentHash = await hashPassword(form.currentPassword)
      const storedHash = editingUser.password_hash || ''
      if (storedHash && currentHash !== storedHash) {
        alert('Current password is incorrect.')
        return
      }
      const pwdValidation = validatePassword(form.password)
      if (!pwdValidation.valid) {
        alert(pwdValidation.message)
        return
      }
      if (form.password !== form.confirmPassword) {
        alert('New password and Confirm password do not match.')
        return
      }
    }
    if (!supabase) {
      alert('Database not configured.')
      return
    }
    setShowSaveConfirm(true)
  }

  const handleConfirmEdit = async () => {
    if (!editingUser || !supabase) return
    setSubmittingEdit(true)
    try {
      const payload = {
        email: form.email.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        status: form.status || 'Active',
      }
      if (canCreateAccounts) {
        payload.account_type = form.accountType || null
        payload.province = form.accountType === 'Regional' ? null : (form.province || null)
        payload.city = form.accountType === 'LGU' ? (form.city.trim() || null) : null
      }
      if (form.password) {
        payload.password_hash = await hashPassword(form.password)
        payload.must_change_password = true
      }
      const { error: updateError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', editingUser.id)
      if (updateError) throw updateError
      await fetchUsers()
      if (fetchPendingUsersCount) fetchPendingUsersCount()
      showSuccess('Success', 'User updated successfully.')
      closeEditModal()
    } catch (err) {
      showSuccess('Error', err.message || 'Failed to update user.')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const displayName = (user) => {
    if (user.first_name != null && user.last_name != null) {
      return `${user.first_name} ${user.last_name}`.trim() || user.email
    }
    return user.name || user.email
  }

  const firstLetter = (user) => {
    const name = displayName(user)
    return name ? name[0].toUpperCase() : '?'
  }

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Number', 'City', 'Status']
    const rows = sortedUsers.map((u) => [
      displayName(u),
      u.email,
      u.phone || '',
      u.city || '',
      u.status || 'Active',
    ])
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const SortIcon = ({ columnKey }) => {
    if (sortKey !== columnKey) return <ChevronDown size={14} className="users-sort-icon inactive" />
    return sortAsc ? <ChevronUp size={14} className="users-sort-icon" /> : <ChevronDown size={14} className="users-sort-icon" />
  }

  return (
    <div className="page users-page">
      <div className="users-card">
        <div className="users-toolbar">
          <h1 className="users-title">Users</h1>
          <div className="users-toolbar-controls">
            <div className="users-showing-select">
              <span className="users-showing-label">Showing</span>
              <span className="users-showing-dropdown-wrap">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="users-showing-dropdown"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <SearchInput
              placeholder="Search users..."
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setCurrentPage(1)
              }}
              suggestions={users.map(u => `${u.first_name} ${u.last_name}`)}
              className="users-search-box"
            />
            <button type="button" className="btn-secondary" onClick={exportCSV}>
              <Upload size={16} />
              Export CSV
            </button>
            <button type="button" className="btn-primary users-btn-add" onClick={openModal}>
              <UserPlus size={18} />
              Add User
            </button>
          </div>
        </div>

        {error && (
          <div className="users-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Loading users..." />
        ) : users.length > 0 ? (
          <>
            <div className="users-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="users-th-sort" onClick={() => handleSort('first_name')}>
                        Name
                        <SortIcon columnKey="first_name" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="users-th-sort" onClick={() => handleSort('email')}>
                        Email
                        <SortIcon columnKey="email" />
                      </button>
                    </th>
                    <th>Number</th>
                    {isSuperAdmin && (
                      <>
                        <th>Account type</th>
                        <th>Province</th>
                      </>
                    )}
                    <th>
                      <button type="button" className="users-th-sort" onClick={() => handleSort('city')}>
                        City
                        <SortIcon columnKey="city" />
                      </button>
                    </th>
                    <th>Status</th>
                    <th className="users-col-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                    {paginatedUsers.map((user) => {
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="users-cell-name">
                              <div className="users-avatar">{firstLetter(user)}</div>
                              {(user.status === 'Pending' || user.must_change_password) && (
                                <span className="table-ping" title="New User" style={{ marginRight: '4px' }}></span>
                              )}
                              {displayName(user)}
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>{user.phone || '-'}</td>
                          {isSuperAdmin && (
                            <>
                              <td>{user.account_type || '-'}</td>
                              <td>{user.province || '-'}</td>
                            </>
                          )}
                          <td>{user.city || '-'}</td>
                          <td>
                            <span className={`users-status users-status-${(user.status || 'Active').toLowerCase()}`}>
                              {user.status || 'Active'}
                            </span>
                          </td>
                          <td className="users-col-action">
                            <button type="button" className="users-btn-view" onClick={() => openViewDetailsModal(user)}>
                              View details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            <div className="users-pagination">
              <button
                type="button"
                className="users-pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                &lt; Previous
              </button>
              <div className="users-pagination-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="users-pagination-ellipsis">...</span>}
                      <button
                        type="button"
                        className={`users-pagination-num ${currentPage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {String(p).padStart(2, '0')}
                      </button>
                    </span>
                  ))}
              </div>
              <button
                type="button"
                className="users-pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next &gt;
              </button>
            </div>
          </>
        ) : !error ? (
          <div className="users-empty">
            No users yet. Click &quot;Add User&quot; to create one.
          </div>
        ) : null}
      </div>

      {isModalOpen && (
        <div className="modal-overlay users-modal-overlay" onClick={closeModal}>
          <div className="modal-content users-modal glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add User</h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-body">
                <div className="users-form-group">
                  <label htmlFor="user-email">Email *</label>
                  <input
                    id="user-email"
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                  />
                </div>
                <div className="users-form-row">
                  <div className="users-form-group">
                    <label htmlFor="user-firstName">First Name *</label>
                    <input
                      id="user-firstName"
                      type="text"
                      placeholder="First name"
                      value={form.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="users-form-group">
                    <label htmlFor="user-lastName">Last Name *</label>
                    <input
                      id="user-lastName"
                      type="text"
                      placeholder="Last name"
                      value={form.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <p className="users-form-hint">A temporary password will be generated and sent to the user&apos;s email.</p>
                <div className="users-form-group">
                  <label htmlFor="user-accountType">Account type *</label>
                  <SearchableSelect
                    value={form.accountType}
                    options={allowedAccountTypes}
                    onChange={(e) => {
                      const newType = e.target.value
                      handleChange('accountType', newType)
                      // Auto-fill province for Provincial/LGU creators
                      if (isProvincial || isLgu) {
                        handleChange('province', currentUser?.province || '')
                      } else {
                        handleChange('province', '')
                      }
                      // Auto-fill city for LGU creators
                      if (isLgu) {
                        handleChange('city', currentUser?.city || '')
                      } else {
                        handleChange('city', '')
                      }
                    }}
                    placeholder="Select type..."
                  />
                </div>
                {form.accountType && (
                  <>
                    {/* Province: auto-filled for Provincial/LGU creators, selectable for Regional/Super Admin */}
                    <div className="users-form-group">
                      <label htmlFor="user-province">Province *</label>
                      {isRegionalOrSuper ? (
                        <SearchableSelect
                          value={form.province}
                          options={PROVINCE_NAMES}
                          onChange={(e) => {
                            handleChange('province', e.target.value)
                            handleChange('city', '')
                          }}
                          placeholder="Select province..."
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentUser?.province || ''}
                          readOnly
                          disabled
                          style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                        />
                      )}
                    </div>
                    {/* City: only for LGU account type */}
                    {form.accountType === 'LGU' && (
                      <div className="users-form-group">
                        <label htmlFor="user-city-lgu">City / Municipality *</label>
                        {isLgu ? (
                          <input
                            type="text"
                            value={currentUser?.city || ''}
                            readOnly
                            disabled
                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                          />
                        ) : (
                          <SearchableSelect
                            value={form.city}
                            options={getCitiesForProvince(form.province || currentUser?.province)}
                            onChange={(e) => handleChange('city', e.target.value)}
                            placeholder="Select city..."
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <Button type="submit" className="modal-btn-primary" isLoading={submitting}>
                  Add User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDetailsUser && (
        <div className="modal-overlay users-modal-overlay" onClick={closeViewDetailsModal}>
          <div className="modal-content users-modal users-details-modal glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User details</h2>
              <button type="button" className="modal-close" onClick={closeViewDetailsModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="users-details-row">
                <span className="users-details-label">Name</span>
                <span className="users-details-value">{displayName(viewDetailsUser)}</span>
              </div>
              <div className="users-details-row">
                <span className="users-details-label">Email</span>
                <span className="users-details-value">{viewDetailsUser.email}</span>
              </div>
              <div className="users-details-row">
                <span className="users-details-label">Number</span>
                <span className="users-details-value">{viewDetailsUser.phone || '—'}</span>
              </div>
              {(viewDetailsUser.account_type || viewDetailsUser.province) && (
                <>
                  <div className="users-details-row">
                    <span className="users-details-label">Account type</span>
                    <span className="users-details-value">{viewDetailsUser.account_type || '—'}</span>
                  </div>
                  <div className="users-details-row">
                    <span className="users-details-label">Province</span>
                    <span className="users-details-value">{viewDetailsUser.province || '—'}</span>
                  </div>
                </>
              )}
              <div className="users-details-row">
                <span className="users-details-label">City</span>
                <span className="users-details-value">{viewDetailsUser.city || '—'}</span>
              </div>
              <div className="users-details-row">
                <span className="users-details-label">Status</span>
                <span className="users-details-value">
                  <span className={`users-status users-status-${(viewDetailsUser.status || 'Active').toLowerCase()}`}>
                    {viewDetailsUser.status || 'Active'}
                  </span>
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-btn-cancel" onClick={closeViewDetailsModal}>
                Close
              </button>
              <button type="button" className="modal-btn-primary" onClick={openEditModalFromDetails}>
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay users-modal-overlay" onClick={closeEditModal}>
          <div className="modal-content users-modal users-edit-modal glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button type="button" className="modal-close" onClick={closeEditModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="modal-body">
                <div className="users-edit-form-grid">
                  <div className="users-form-group users-edit-full-width">
                    <label htmlFor="edit-user-email">Email *</label>
                    <input
                      id="edit-user-email"
                      type="email"
                      placeholder="email@example.com"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="users-form-row users-edit-full-width">
                    <div className="users-form-group">
                      <label htmlFor="edit-user-firstName">First Name *</label>
                      <input
                        id="edit-user-firstName"
                        type="text"
                        placeholder="First name"
                        value={form.firstName}
                        onChange={(e) => handleChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="users-form-group">
                      <label htmlFor="edit-user-lastName">Last Name *</label>
                      <input
                        id="edit-user-lastName"
                        type="text"
                        placeholder="Last name"
                        value={form.lastName}
                        onChange={(e) => handleChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="users-form-group">
                    <label htmlFor="edit-user-phone">Number</label>
                    <input
                      id="edit-user-phone"
                      type="tel"
                      placeholder="Phone number"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                  </div>
                  <div className="users-form-group">
                    <label htmlFor="edit-user-accountType">Account type *</label>
                    <SearchableSelect
                      value={form.accountType}
                      options={isSuperAdmin ? ['Regional', 'Provincial', 'Provincial Approver', 'LGU'] : allowedAccountTypes}
                      onChange={(e) => {
                        const newType = e.target.value
                        handleChange('accountType', newType)
                        // Auto-fill province for Provincial/LGU creators
                        if (isProvincial || isLgu) {
                          handleChange('province', currentUser?.province || '')
                        } else {
                          handleChange('province', '')
                        }
                        // Auto-fill city for LGU creators
                        if (isLgu) {
                          handleChange('city', currentUser?.city || '')
                        } else {
                          handleChange('city', '')
                        }
                      }}
                      placeholder="Select type..."
                    />
                  </div>
                  {form.accountType && (
                    <>
                      <div className="users-form-group">
                        <label htmlFor="edit-user-province">Province *</label>
                        {isRegionalOrSuper ? (
                          <SearchableSelect
                            value={form.province}
                            options={PROVINCE_NAMES}
                            onChange={(e) => {
                              handleChange('province', e.target.value)
                              handleChange('city', '')
                            }}
                            placeholder="Select province..."
                          />
                        ) : (
                          <input
                            type="text"
                            value={form.province || currentUser?.province || ''}
                            readOnly
                            disabled
                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                          />
                        )}
                      </div>
                      {form.accountType === 'LGU' && (
                        <div className="users-form-group">
                          <label htmlFor="edit-user-city-lgu">City / Municipality *</label>
                          {isLgu ? (
                            <input
                              type="text"
                              value={form.city || currentUser?.city || ''}
                              readOnly
                              disabled
                              style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                            />
                          ) : (
                            <SearchableSelect
                              value={form.city}
                              options={getCitiesForProvince(form.province || currentUser?.province)}
                              onChange={(e) => handleChange('city', e.target.value)}
                              placeholder="Select city..."
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <div className="users-form-group users-edit-full-width">
                    <label htmlFor="edit-user-status">Status</label>
                    <SearchableSelect
                      value={form.status}
                      options={['Active', 'Inactive']}
                      onChange={(e) => handleChange('status', e.target.value)}
                      placeholder="Select status..."
                    />
                  </div>
                  <div className="users-form-section-label users-edit-full-width users-edit-section-label">Change password (optional)</div>
                  <div className="users-form-group users-edit-full-width">
                    <label htmlFor="edit-user-currentPassword">Current password</label>
                    <div className="users-password-input-wrap">
                      <input
                        id="edit-user-currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Enter current password to change"
                        value={form.currentPassword}
                        onChange={(e) => handleChange('currentPassword', e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="users-password-toggle"
                        onClick={() => setShowCurrentPassword((p) => !p)}
                        aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="users-form-group">
                    <label htmlFor="edit-user-password">New password</label>
                    <div className="users-password-input-wrap">
                      <input
                        id="edit-user-password"
                        type={showEditPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters, uppercase and lowercase"
                        value={form.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        minLength={form.password ? 8 : 0}
                        autoComplete="new-password"
                        className={form.password && !getPasswordRules(form.password).allValid ? 'users-input-invalid' : ''}
                      />
                      <button
                        type="button"
                        className="users-password-toggle"
                        onClick={() => setShowEditPassword((p) => !p)}
                        aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className="users-password-rules" aria-live="polite">
                      <span className={getPasswordRules(form.password).length ? 'users-rule-ok' : 'users-rule-pending'}>
                        {getPasswordRules(form.password).length ? '✓' : '○'} At least 8 characters
                      </span>
                      <span className={getPasswordRules(form.password).uppercase ? 'users-rule-ok' : 'users-rule-pending'}>
                        {getPasswordRules(form.password).uppercase ? '✓' : '○'} One uppercase letter
                      </span>
                      <span className={getPasswordRules(form.password).lowercase ? 'users-rule-ok' : 'users-rule-pending'}>
                        {getPasswordRules(form.password).lowercase ? '✓' : '○'} One lowercase letter
                      </span>
                    </div>
                  </div>
                  <div className="users-form-group">
                    <label htmlFor="edit-user-confirmPassword">Confirm new password</label>
                    <div className="users-password-input-wrap">
                      <input
                        id="edit-user-confirmPassword"
                        type={showEditConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        value={form.confirmPassword}
                        onChange={(e) => handleChange('confirmPassword', e.target.value)}
                        minLength={form.password ? 8 : 0}
                        autoComplete="new-password"
                        className={form.confirmPassword && form.password !== form.confirmPassword ? 'users-input-invalid' : ''}
                      />
                      <button
                        type="button"
                        className="users-password-toggle"
                        onClick={() => setShowEditConfirmPassword((p) => !p)}
                        aria-label={showEditConfirmPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showEditConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {form.confirmPassword.length > 0 && (
                      <span className={form.password === form.confirmPassword ? 'users-confirm-ok' : 'users-confirm-error'} role="status">
                        {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="modal-btn-cancel" onClick={closeEditModal}>
                  Cancel
                </button>
                <Button type="submit" className="modal-btn-primary" isLoading={submittingEdit}>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="modal-overlay users-modal-overlay" onClick={() => setShowSaveConfirm(false)}>
          <div className="modal-content glass-modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-confirm">
              <div className="modal-confirm-icon modal-confirm-icon--warning">
                <AlertCircle size={32} />
              </div>
              <h3 className="modal-confirm-title">Confirm Changes</h3>
              <p className="modal-confirm-text">Are you sure you want to save these changes to the user account?</p>
              <div className="modal-confirm-footer">
                <button type="button" className="modal-btn-cancel" onClick={() => setShowSaveConfirm(false)}>
                  Cancel
                </button>
                <Button type="button" className="modal-btn-primary" isLoading={submittingEdit} onClick={handleConfirmEdit}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tempPasswordResult && (
        <div className="modal-overlay users-modal-overlay" onClick={() => setTempPasswordResult(null)}>
          <div className="modal-content users-modal users-temp-password-modal glass-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User created</h2>
              <button type="button" className="modal-close" onClick={() => setTempPasswordResult(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <p className="users-temp-password-intro">
              An email with a temporary password has been sent to <strong>{tempPasswordResult.email}</strong>. The user should change it after first login.
            </p>
            <p className="users-temp-password-rules">Password rules: at least 8 characters, one uppercase, one lowercase.</p>
            <div className="modal-footer">
              <button type="button" className="modal-btn-primary" onClick={() => setTempPasswordResult(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
