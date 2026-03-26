import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { BadgeCheck, Upload, Eye, Lock, LogOut, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Card, Btn, Input, Avatar, SectionHeader } from '../../components/ui'
import toast from 'react-hot-toast'

// Upload a file to Supabase storage and return its public URL
async function uploadToSupabase(file, bucket, pathPrefix) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  const ext  = file.name.split('.').pop()
  const path = `${pathPrefix}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// A single document upload row with thumbnail preview
function DocRow({ label, fieldKey, currentUrl, onUpload, uploading }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F4F5FA] last:border-0">
      <div className="flex items-center gap-3">
        {currentUrl ? (
          <a href={currentUrl} target="_blank" rel="noreferrer">
            <img src={currentUrl} alt={label} className="w-14 h-10 rounded-lg object-cover border border-[#E8E9F2] hover:opacity-80 transition-opacity" />
          </a>
        ) : (
          <div className="w-14 h-10 rounded-lg border-2 border-dashed border-[#E8E9F2] flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-[#C4C8E8]" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-[#374151]">{label}</p>
          <p className="text-xs text-[#9CA3AF]">{currentUrl ? 'Uploaded' : 'Not uploaded'}</p>
        </div>
      </div>
      <label className="cursor-pointer">
        <input type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onUpload(fieldKey, e.target.files[0]) }} />
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${uploading === fieldKey ? 'bg-[#F4F5FA] text-[#9CA3AF]' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}>
          {uploading === fieldKey ? 'Uploading...' : <><Upload className="w-3 h-3" /> Upload</>}
        </span>
      </label>
    </div>
  )
}

export default function TenantProfile() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [uploading, setUploading]   = useState(null)
  const [showPw, setShowPw]         = useState(false)
  const [pwForm, setPwForm]         = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwLoading, setPwLoading]   = useState(false)

  // Upload a document and save the URL back to the user record
  async function handleDocUpload(fieldKey, file) {
    setUploading(fieldKey)
    try {
      const folder = `${user.id}/${fieldKey}`
      const bucket = fieldKey === 'profile_photo_url' ? 'profiles' : 'documents'
      const url = await uploadToSupabase(file, bucket, folder)

      // Save the URL to the backend
      await api.patch('/api/tenants/me/documents', { [fieldKey]: url })
      updateUser({ [fieldKey]: url })
      toast.success(`${fieldKey.replace(/_url$/,'').replace(/_/g,' ')} uploaded`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(null)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) return toast.error('Passwords do not match')
    if (pwForm.new_password.length < 8) return toast.error('Minimum 8 characters')
    setPwLoading(true)
    try {
      await api.patch('/api/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password })
      toast.success('Password updated')
      setShowPw(false)
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  const docs = [
    { label: 'Profile Photo',      key: 'profile_photo_url',  url: user?.profile_photo_url  },
    { label: 'Aadhaar Card Front', key: 'aadhaar_front_url',  url: user?.aadhaar_front_url  },
    { label: 'Aadhaar Card Back',  key: 'aadhaar_back_url',   url: user?.aadhaar_back_url   },
    { label: 'PAN Card',           key: 'pan_card_url',       url: user?.pan_card_url       },
    { label: 'Driving Licence',    key: 'driving_license_url',url: user?.driving_license_url},
    { label: 'Passport',           key: 'passport_url',       url: user?.passport_url       },
  ]

  return (
    <div className="space-y-5 max-w-lg">
      <SectionHeader title="My Profile" />

      {/* Avatar with upload */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={user?.full_name} src={user?.profile_photo_url} size={16} />
            {user?.is_approved && (
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-blue-500 bg-white rounded-full" />
            )}
            <label className="absolute bottom-0 right-0 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors">
              <Camera className="w-3 h-3 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDocUpload('profile_photo_url', e.target.files[0]) }} />
            </label>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0D0D12]">{user?.full_name}</h2>
            <p className="text-xs text-[#9CA3AF]">{user?.email}</p>
            {user?.is_approved
              ? <p className="text-xs text-blue-500 font-semibold flex items-center gap-1 mt-1"><BadgeCheck className="w-3.5 h-3.5" /> Verified Tenant</p>
              : <p className="text-xs text-amber-500 font-semibold mt-1">Pending approval by manager</p>
            }
          </div>
        </div>
      </Card>

      {/* Personal info */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E9F2]">
          <p className="font-display font-bold text-sm text-[#0D0D12]">Personal Info</p>
        </div>
        <div className="divide-y divide-[#F4F5FA]">
          {[
            ['Occupation',  user?.occupation],
            ['Gender',      user?.gender],
            ['Phone',       user?.phone],
            ['Guardian',    user?.guardian_name],
            ['Address',     user?.permanent_address],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-[#6B7280]">{label}</span>
              <span className="text-sm font-medium text-[#0D0D12] text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Document uploads */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E9F2]">
          <p className="font-display font-bold text-sm text-[#0D0D12]">Documents</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Upload your ID documents for verification</p>
        </div>
        <div className="px-4">
          {docs.map(d => (
            <DocRow key={d.key} label={d.label} fieldKey={d.key} currentUrl={d.url}
              onUpload={handleDocUpload} uploading={uploading} />
          ))}
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-4">
        <button onClick={() => setShowPw(v => !v)} className="flex items-center gap-2 w-full text-left">
          <Lock className="w-4 h-4 text-[#6B7280]" />
          <span className="font-semibold text-sm text-[#0D0D12]">Change Password</span>
          <span className="ml-auto text-xs text-brand-500">{showPw ? 'Cancel' : 'Change'}</span>
        </button>
        {showPw && (
          <form onSubmit={handleChangePassword} className="space-y-3 mt-4">
            <Input label="Current Password" type="password" value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
            <Input label="New Password" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
            <Input label="Confirm Password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            <Btn type="submit" className="w-full" loading={pwLoading}>Save New Password</Btn>
          </form>
        )}
      </Card>

      <Btn variant="danger" className="w-full" onClick={() => { logout(); navigate('/login') }}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Btn>
    </div>
  )
}
