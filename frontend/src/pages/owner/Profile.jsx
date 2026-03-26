import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Lock, BadgeCheck, Building2, Phone, Mail, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { Card, Btn, Input, Avatar, SectionHeader } from '../../components/ui'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [pwForm, setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  async function handleChangePassword(e) {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm)
      return toast.error('New passwords do not match')
    if (pwForm.new_password.length < 8)
      return toast.error('Password must be at least 8 characters')
    setPwLoading(true)
    try {
      await api.patch('/api/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      toast.success('Password changed successfully')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
      setShowPw(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const rows = [
    ['Full Name',    user?.full_name  || '—'],
    ['Email',        user?.email      || '—'],
    ['Role',         user?.role       || '—'],
  ]

  return (
    <div className="space-y-5 max-w-lg">
      <SectionHeader title="Profile" />

      {/* Avatar + name card */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={user?.full_name} src={user?.profile_photo_url} size={16} />
            {user?.is_approved && (
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-blue-500 bg-white rounded-full" />
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0D0D12]">{user?.full_name}</h2>
            <span className="inline-block text-xs px-2.5 py-1 rounded-xl bg-brand-50 text-brand-700 font-semibold capitalize mt-0.5">
              {user?.role}
            </span>
            {user?.is_approved && (
              <p className="text-xs text-blue-500 font-medium flex items-center gap-1 mt-1">
                <BadgeCheck className="w-3 h-3" /> Verified Account
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Account details */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E9F2]">
          <p className="font-display font-bold text-[#0D0D12] text-sm">Account Details</p>
        </div>
        <div className="divide-y divide-[#F4F5FA]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-[#6B7280] font-medium">{label}</span>
              <span className="text-sm font-semibold text-[#0D0D12] capitalize">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-4">
        <button
          onClick={() => setShowPw(v => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Lock className="w-4 h-4 text-[#6B7280]" />
          <span className="font-semibold text-sm text-[#0D0D12]">Change Password</span>
          <span className="ml-auto text-xs text-brand-500">{showPw ? 'Cancel' : 'Change'}</span>
        </button>

        {showPw && (
          <form onSubmit={handleChangePassword} className="space-y-3 mt-4">
            <Input label="Current Password" type="password" value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
            <Input label="New Password" type="password" value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
            <Input label="Confirm New Password" type="password" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            <Btn type="submit" className="w-full" loading={pwLoading}>
              Update Password
            </Btn>
          </form>
        )}
      </Card>

      {/* Sign out */}
      <Btn variant="danger" className="w-full" onClick={handleLogout}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Btn>
    </div>
  )
}
