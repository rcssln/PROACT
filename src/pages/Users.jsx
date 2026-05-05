import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Upload, UserPlus, X, CaretDown, CaretUp, Eye, EyeClosed, WarningCircle, Plus, FileCsv, PencilSimple, Trash, MagnifyingGlass, UserCircle, Envelope, Phone, Shield, MapPin, Copy, Check } from '@phosphor-icons/react'
import SearchInput from '../components/SearchInput'
import SearchableSelect from '../components/SearchableSelect'
import LoadingSpinner from '../components/LoadingSpinner'
import { useEvents } from '../contexts/EventContext'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { LGU_NAMES } from '../data/locations'
import { PROVINCE_NAMES, getCitiesForProvince } from '../data/provinces'
import { validatePassword, hashPassword, getPasswordRules } from '../lib/passwordUtils'
import Button from '../components/Button'
import HeaderFooterModal from '../components/HeaderFooterModal'
import ConfirmationModal from '../components/ConfirmationModal'
import '../styles/pages/PageStyles.css'
import '../styles/pages/ConsolidatedReport.css'
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

  const accountType = currentUser?.account_type || ''
  const isSuperAdmin = currentUser?.role === 'Super Admin' || accountType === 'Super Admin'
  const isRegionalAdmin = accountType === 'Regional Admin'
  const isProvincialAdmin = accountType === 'Provincial Admin'
  const isLguAdmin = accountType === 'LGU Admin'
  // Any admin that has access to this page
  const isAdmin = isRegionalAdmin || isProvincialAdmin || isLguAdmin || isSuperAdmin

  // --- Allowed account types each admin tier can create (hierarchy) ---
  const allowedAccountTypes = (() => {
    if (isSuperAdmin || isRegionalAdmin)
      return ['Regional Admin', 'Regional', 'Provincial Admin', 'Provincial Approver', 'Provincial', 'LGU Admin', 'LGU']
    if (isProvincialAdmin)
      return ['Provincial Admin', 'Provincial Approver', 'Provincial', 'LGU Admin', 'LGU']
    if (isLguAdmin)
      return ['LGU Admin', 'LGU']
    return []
  })()

  const canCreateAccounts = allowedAccountTypes.length > 0
  // Convenience flags used in the form for province/city locking
  const isRegionalOrSuper = isSuperAdmin || isRegionalAdmin
  const isProvincial = isProvincialAdmin
  const isLgu = isLguAdmin
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
  const [tempPasswordResult, setTempPasswordResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchUsers = async () => {
    if (!supabase) {
      setUsers(MOCK_USERS)
      setLoading(false)
      return
    }
    try {
      setError(null)
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      // Scope data by admin type:
      // Provincial Admin → only their province
      if (isProvincialAdmin && !isSuperAdmin && !isRegionalAdmin) {
        query = query.eq('province', currentUser?.province)
          .in('account_type', ['Provincial Admin', 'Provincial Approver', 'Provincial', 'LGU Admin', 'LGU'])
      }
      // LGU Admin → only their city
      if (isLguAdmin && !isSuperAdmin && !isRegionalAdmin && !isProvincialAdmin) {
        query = query.eq('city', currentUser?.city)
          .in('account_type', ['LGU Admin', 'LGU'])
      }
      // Regional Admin / Super Admin → see all (no extra filter)

      const { data, error: fetchError } = await query
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
    if (form.accountType?.includes('LGU') && !form.city) {
      showSuccess('Validation Error', 'Please select a City for LGU account.')
      return
    }
    if (supabase) {
      showConfirm({
        title: 'Add New User',
        message: `Are you sure you want to add ${form.email}? An invitation email will be sent.`,
        onConfirm: async () => {
          setSubmitting(true)
          try {
            const url = `${supabaseUrl}/functions/v1/create-user-invite`
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseAnonKey}`,
                apikey: supabaseAnonKey,
              },
              body: JSON.stringify({
                email: form.email.trim(),
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                account_type: form.accountType || null,
                province: form.province || null,
                city: (form.accountType?.includes('LGU') || form.accountType?.includes('Provincial')) ? (form.city.trim() || null) : null,
                caller_id: currentUser?.id,
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              const msg = typeof data?.error === 'string' ? data.error : data?.error?.message || res.statusText || 'Invite failed'
              throw new Error(msg)
            }
            await fetchUsers()
            if (fetchPendingUsersCount) fetchPendingUsersCount()
            setTempPasswordResult({ 
              email: form.email.trim(), 
              emailSent: data.emailSent,
              emailError: data.emailError,
              password: data.tempPassword || null
            })
            closeModal()
          } catch (err) {
            showSuccess('Error', err.message || 'Failed to add user.')
          } finally {
            setSubmitting(false)
          }
        }
      })
    } else {
      showSuccess('Configuration Error', 'Database not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      showSuccess('Validation Error', 'Please fill in Email, First Name, and Last Name.')
      return
    }
    if (canCreateAccounts) {
      if (!form.accountType) {
        showSuccess('Validation Error', 'Please select Account type.')
        return
      }
      if (form.accountType !== 'Regional' && !form.province) {
        showSuccess('Validation Error', 'Please select a Province.')
        return
      }
      if (form.accountType?.includes('LGU') && !form.city) {
        showSuccess('Validation Error', 'Please select a City for LGU account.')
        return
      }
    }
    if (form.password || form.confirmPassword) {
      if (!form.currentPassword.trim()) {
        showSuccess('Validation Error', 'Please enter the current password to change password.')
        return
      }
      const currentHash = await hashPassword(form.currentPassword, currentUser?.email || '')
      const storedHash = editingUser.password_hash || ''
      if (storedHash && currentHash !== storedHash) {
        showSuccess('Validation Error', 'Current password is incorrect.')
        return
      }
      const pwdValidation = validatePassword(form.password)
      if (!pwdValidation.valid) {
        showSuccess('Validation Error', pwdValidation.message)
        return
      }
      if (form.password !== form.confirmPassword) {
        showSuccess('Validation Error', 'New password and Confirm password do not match.')
        return
      }
    }
    if (!supabase) {
      showSuccess('Database Error', 'Database not configured.')
      return
    }

    showConfirm({
      title: 'Confirm Changes',
      message: 'Are you sure you want to save these changes to the user account?',
      onConfirm: handleConfirmEdit
    })
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
        payload.city = (form.accountType?.includes('LGU') || form.accountType?.includes('Provincial')) ? (form.city.trim() || null) : null
      }
      if (form.password) {
        payload.password_hash = await hashPassword(form.password, form.email)
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
    const headers = ['Name', 'Email', 'Province', 'City', 'Position', 'Status']
    const rows = sortedUsers.map((u) => [
      displayName(u),
      u.email,
      u.province || '',
      u.city || '',
      u.account_type || '',
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
    if (sortKey !== columnKey) return <CaretDown size={14} className="users-sort-icon inactive" />
    return sortAsc ? <CaretUp size={14} className="users-sort-icon" /> : <CaretDown size={14} className="users-sort-icon" />
  }

  if (!isAdmin) {
    return (
      <div className="page users-page">
        <div className="users-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <h2 style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '12px' }}>Access Denied</h2>
          <p style={{ color: 'var(--color-text-muted, #64748b)' }}>
            You do not have permission to view this page. Only Admin accounts can manage users.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page consolidated-report-page">
      <div className="consolidated-report-card">
        <div className="consolidated-report-toolbar">
          <div className="consolidated-report-header-stack">
            <h1 className="consolidated-report-title">Users</h1>
          </div>
          <div className="consolidated-report-toolbar-controls">
            <SearchInput
              placeholder="Search users..."
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val)
                setCurrentPage(1)
              }}
              suggestions={users.map(u => `${u.first_name} ${u.last_name}`)}
              className="consolidated-report-search-box"
            />
            <Button 
              variant="solid" 
              color="success"
              onClick={exportCSV}
              leftIcon={<Upload size={16} />}
            >
              Export CSV
            </Button>
            <Button 
              variant="solid" 
              color="primary" 
              onClick={openModal}
              leftIcon={<UserPlus size={18} />}
            >
              Add User
            </Button>
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
            <div className="consolidated-report-table-wrapper">
              <table className="consolidated-report-table">
                <thead>
                  <tr>
                    <th>
                      <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('first_name')}>
                        Name
                        <SortIcon columnKey="first_name" />
                      </Button>
                    </th>
                    <th>
                      <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('email')}>
                        Email
                        <SortIcon columnKey="email" />
                      </Button>
                    </th>
                    {(isSuperAdmin || isRegionalAdmin) && (
                      <th>Province</th>
                    )}
                    <th>
                      <Button variant="ghost" className="consolidated-th-sort" onClick={() => handleSort('account_type')}>
                        Position
                        <SortIcon columnKey="account_type" />
                      </Button>
                    </th>
                    <th>Status</th>
                    <th className="col-action">Actions</th>
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
                          {(isSuperAdmin || isRegionalAdmin) && (
                            <td>{user.province || '-'}</td>
                          )}
                          <td>{user.account_type || '-'}</td>
                          <td>
                            <span className={`users-status users-status-${(user.status || 'Active').toLowerCase()}`}>
                              {user.status || 'Active'}
                            </span>
                          </td>
                          <td className="col-action">
                            <div className="consolidated-actions">
                              <Button
                                variant="solid"
                                color="info"
                                size="sm"
                                onClick={() => openViewDetailsModal(user)}
                                icon={<Eye size={16} />}
                              >
                                View details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            <div className="consolidated-report-pagination">
              <Button
                variant="subtle"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                &lt; Previous
              </Button>
              <Button
                variant="subtle"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next &gt;
              </Button>
            </div>
          </>
        ) : !error ? (
          <div className="users-empty">
            No users yet. Click &quot;Add User&quot; to create one.
          </div>
        ) : null}
      </div>

      <HeaderFooterModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Add User"
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="subtle" onClick={closeModal}>Cancel</Button>
            <Button 
              variant="solid" 
              color="primary" 
              onClick={() => document.getElementById('add-user-form').requestSubmit()} 
              isLoading={submitting}
            >
              {submitting ? 'Adding...' : 'Add User'}
            </Button>
          </div>
        }
      >
        <form id="add-user-form" onSubmit={handleSubmit}>
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
              {(form.accountType?.includes('LGU') || form.accountType?.includes('Provincial')) && (
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
        </form>
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={!!viewDetailsUser}
        onClose={closeViewDetailsModal}
        title="User Details"
        maxWidth="500px"
        footer={
          <>
            <Button variant="subtle" onClick={closeViewDetailsModal}>Close</Button>
            <Button variant="solid" onClick={openEditModalFromDetails}>Edit</Button>
          </>
        }
      >
        {viewDetailsUser && (
          <div className="details-modal-content">
            <div className="details-status-top">
              <div className="details-status-type" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="users-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                  {firstLetter(viewDetailsUser)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Details</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>{displayName(viewDetailsUser)}</span>
                </div>
              </div>
              <span className={`users-status users-status-${(viewDetailsUser.status || 'Active').toLowerCase()}`}>
                {viewDetailsUser.status || 'Active'}
              </span>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className="details-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Envelope size={18} color="var(--text-muted)" />
                  Email Address
                </span>
                <span>{viewDetailsUser.email}</span>
              </div>
              <div className="details-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={18} color="var(--text-muted)" />
                  Phone Number
                </span>
                <span>{viewDetailsUser.phone || '—'}</span>
              </div>
              <div className="details-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="var(--text-muted)" />
                  Account Type
                </span>
                <span>{viewDetailsUser.account_type || '—'}</span>
              </div>
              <div className="details-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} color="var(--text-muted)" />
                  Location
                </span>
                <span>
                  {viewDetailsUser.province || '—'}
                  {viewDetailsUser.city ? `, ${viewDetailsUser.city}` : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </HeaderFooterModal>

      <HeaderFooterModal
        isOpen={!!editingUser}
        onClose={closeEditModal}
        title="Edit User"
        maxWidth="640px"
        bodyPadding="0"
        footer={
          <>
            <Button variant="subtle" onClick={closeEditModal}>Cancel</Button>
            <Button variant="solid" onClick={() => document.getElementById('edit-user-form').requestSubmit()} isLoading={submittingEdit}>Save Changes</Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditSubmit} className="users-edit-form">
          <div className="users-edit-form-grid">
            <div className="users-form-group users-edit-full-width">
              <label htmlFor="edit-user-email">Email Address *</label>
              <input
                id="edit-user-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            
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

            <div className="users-form-group">
              <label htmlFor="edit-user-phone">Phone Number</label>
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
                options={allowedAccountTypes}
                onChange={(e) => {
                  const newType = e.target.value
                  handleChange('accountType', newType)
                  if (isProvincial || isLgu) {
                    handleChange('province', currentUser?.province || '')
                  } else {
                    handleChange('province', '')
                  }
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
                {(form.accountType?.includes('LGU') || form.accountType?.includes('Provincial')) && (
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
            
            <div className="users-edit-section-header users-edit-full-width">
              <h4 className="users-edit-section-title">Change Password (Optional)</h4>
              <p className="users-edit-section-subtitle">Only fill this if you want to update the user&apos;s password.</p>
            </div>

            <div className="users-form-group users-edit-full-width">
              <label htmlFor="edit-user-currentPassword">Current Password</label>
              <div className="users-password-input-wrap">
                <input
                  id="edit-user-currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password to verify"
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
                  {showCurrentPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="users-form-group">
              <label htmlFor="edit-user-password">New Password</label>
              <div className="users-password-input-wrap">
                <input
                  id="edit-user-password"
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
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
                  {showEditPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="users-form-group">
              <label htmlFor="edit-user-confirmPassword">Confirm New Password</label>
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
                  {showEditConfirmPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            {(form.password || form.confirmPassword) && (
              <div className="users-password-rules-summary users-edit-full-width">
                <div className="users-password-rules" aria-live="polite">
                  <span className={getPasswordRules(form.password).length ? 'users-rule-ok' : 'users-rule-pending'}>
                    {getPasswordRules(form.password).length ? '✓' : '○'} 8+ chars
                  </span>
                  <span className={getPasswordRules(form.password).uppercase ? 'users-rule-ok' : 'users-rule-pending'}>
                    {getPasswordRules(form.password).uppercase ? '✓' : '○'} Upper
                  </span>
                  <span className={getPasswordRules(form.password).lowercase ? 'users-rule-ok' : 'users-rule-pending'}>
                    {getPasswordRules(form.password).lowercase ? '✓' : '○'} Lower
                  </span>
                  <span className={form.password === form.confirmPassword && form.confirmPassword ? 'users-rule-ok' : 'users-rule-pending'}>
                    {form.password === form.confirmPassword && form.confirmPassword ? '✓' : '○'} Match
                  </span>
                </div>
              </div>
            )}
          </div>
        </form>
      </HeaderFooterModal>



      <ConfirmationModal
        isOpen={!!tempPasswordResult}
        onClose={() => {
          setTempPasswordResult(null)
          setCopied(false)
        }}
        type="success"
        title={tempPasswordResult?.emailSent ? "User Created Successfully" : "User Created (Email Failed)"}
        message={tempPasswordResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!tempPasswordResult.emailSent && (
              <div style={{ 
                background: '#fff7ed', 
                padding: '0.875rem', 
                borderRadius: '6px', 
                border: '1px solid #ffedd5',
                color: '#9a3412',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600 }}>
                  <WarningCircle size={18} />
                  Email Delivery Failed
                </div>
                The account was created, but the invitation email could not be sent. 
                {tempPasswordResult.emailError && (
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', opacity: 0.8 }}>
                    Error: {tempPasswordResult.emailError}
                  </div>
                )}
                Please check your email service configuration (Brevo) or the user's email address.
              </div>
            )}

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' }}>
              The user will be required to change their password upon their first login.
            </p>

          </div>
        ) : null}
        confirmText="Done"
        onConfirm={() => {
          setTempPasswordResult(null)
          setCopied(false)
        }}
      />
    </div>
  )
}
