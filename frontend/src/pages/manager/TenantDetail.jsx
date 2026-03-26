import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, BadgeCheck, Shield, FileText, CheckCircle2, XCircle, Clock, Download, Phone, Mail, MapPin, Building2, Calendar } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, Btn, Badge, Avatar, Modal, Input, Textarea, Toggle, Skel } from '../../components/ui'
import { formatRupees, formatDate, titleCase } from '../../lib/utils'
import toast from 'react-hot-toast'

const TABS = ['Profile', 'Documents', 'Verification', 'Rent', 'Complaints']

// A single verification step toggle card
function VerifCard({ label, statusKey, notesKey, bgv, onUpdate }) {
  const isVerified = bgv[statusKey] === 'verified'
  const isRejected = bgv[statusKey] === 'rejected'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isVerified ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : isRejected ? <XCircle className="w-5 h-5 text-red-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
          <p className="font-semibold text-sm text-[#0D0D12]">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={bgv[statusKey] || 'pending'} />
          <Toggle
            checked={isVerified}
            onChange={(val) => onUpdate(statusKey, val ? 'verified' : 'pending')}
          />
        </div>
      </div>
      <Textarea
        rows={2}
        placeholder="Add verification notes here..."
        value={bgv[notesKey] || ''}
        onChange={e => onUpdate(notesKey, e.target.value)}
      />
      {isVerified && bgv[statusKey.replace('_verification','_verified_date')] && (
        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Verified on {formatDate(bgv[statusKey.replace('_verification','_verified_date')])}
        </p>
      )}
    </Card>
  )
}

// Show a document image with a label and status
function DocImage({ label, url, verified }) {
  if (!url) return (
    <div className="p-4 rounded-2xl border-2 border-dashed border-[#E8E9F2] text-center">
      <p className="text-xs text-[#9CA3AF]">{label}</p>
      <p className="text-xs text-[#C4C8E8] mt-1">Not uploaded</p>
    </div>
  )
  return (
    <div className="rounded-2xl overflow-hidden border border-[#E8E9F2]">
      <div className="bg-[#F4F5FA] px-3 py-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#374151]">{label}</p>
        {verified && <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Verified</span>}
      </div>
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={label} className="w-full h-36 object-cover hover:opacity-90 transition-opacity" />
      </a>
    </div>
  )
}

export default function TenantDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [tab, setTab] = useState('Profile')
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm]   = useState({ amount_paid: '', paid_date: '', payment_mode: 'upi', transaction_id: '', notes: '' })

  // Fetch full tenant data including user, tenancy, and verification
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-detail', id],
    queryFn:  () => api.get(`/api/tenants/${id}`),
  })

  const { data: rentData } = useQuery({
    queryKey: ['rent', id],
    queryFn:  () => api.get(`/api/rent?tenant_id=${id}`),
  })

  const { data: compData } = useQuery({
    queryKey: ['complaints-tenant', id],
    queryFn:  () => api.get(`/api/complaints?tenant_id=${id}`),
  })

  const user    = data?.user    || {}
  const tenancy = data?.tenancy || null
  const bgv     = data?.verification || {}

  const allVerified = bgv.police_verification === 'verified' && bgv.aadhaar_verification === 'verified' && bgv.work_verification === 'verified'

  // Update a verification field and save it immediately
  const updateBGV = async (field, value) => {
    try {
      await api.patch(`/api/verification/${id}`, { [field]: value })
      qc.invalidateQueries(['tenant-detail', id])
      if (field.endsWith('_verification') && value === 'verified') toast.success('Verification updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/api/tenants/approve/${id}`),
    onSuccess: () => { toast.success('Tenant approved and verified'); qc.invalidateQueries(['tenant-detail', id]) },
    onError:   e => toast.error(e.message),
  })

  const confirmPayMutation = useMutation({
    mutationFn: () => api.post(`/api/rent/${payModal}/confirm`, payForm),
    onSuccess: () => { toast.success('Payment confirmed'); setPayModal(null); qc.invalidateQueries(['rent', id]) },
    onError:   e => toast.error(e.message),
  })

  // Open police verification PDF in a new tab
  const downloadVerifPDF = () => {
    const token = localStorage.getItem('pg_token')
    const base  = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    window.open(`${base}/api/verification/${id}/pdf?token=${token}`, '_blank')
  }

  if (isLoading) return (
    <div className="space-y-4">
      <Skel className="h-20" /><Skel className="h-10" /><Skel className="h-64" />
    </div>
  )

  const rentRecords = rentData?.records || []
  const complaints  = compData || []

  return (
    <div className="space-y-4 pb-10">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0D0D12] transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Tenants
      </button>

      {/* Tenant header card */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar name={user.full_name} src={user.profile_photo_url} size={16} />
            {user.is_approved && allVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white" title="Fully verified">
                <BadgeCheck className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-bold text-[#0D0D12]">{user.full_name}</h1>
              {user.is_approved && <span className="badge bg-blue-50 text-blue-700 border border-blue-200 gap-1"><BadgeCheck className="w-3 h-3" /> Verified</span>}
              {!user.is_approved && <Badge status="pending" />}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#6B7280]">
              {user.email    && <span className="flex items-center gap-1"><Mail  className="w-3 h-3" />{user.email}</span>}
              {user.phone    && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>}
              {user.occupation && <span>{user.occupation}</span>}
              {user.gender   && <span>{user.gender}</span>}
            </div>
            {tenancy && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1 text-brand-600 font-medium">
                  <Building2 className="w-3 h-3" />Room {tenancy.room?.room_number} · Bed {tenancy.bed?.bed_number}
                </span>
                <span className="flex items-center gap-1 text-[#6B7280]">
                  <Calendar className="w-3 h-3" />Since {formatDate(tenancy.check_in_date)}
                </span>
                <span className="font-semibold text-[#0D0D12]">{formatRupees(tenancy.rent_amount)}/mo</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex border-b border-[#E8E9F2] bg-white rounded-2xl overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold whitespace-nowrap transition-colors min-w-[80px] ${tab === t ? 'text-brand-600 border-b-2 border-brand-500' : 'text-[#6B7280] hover:text-[#374151]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'Profile' && (
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <p className="font-semibold text-sm text-[#374151] border-b border-[#E8E9F2] pb-2">Personal Information</p>
            {[
              ['Date of Birth', formatDate(user.date_of_birth)],
              ['Gender', titleCase(user.gender)],
              ['Occupation', user.occupation],
              ['Institute / Company', user.institute_or_company],
              ['Institute Location', user.institute_location],
              ['Expected Stay', user.expected_stay_duration],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">{label}</span>
                <span className="text-[#0D0D12] font-medium text-right max-w-[60%]">{val}</span>
              </div>
            ) : null)}
          </Card>
          <Card className="p-4 space-y-3">
            <p className="font-semibold text-sm text-[#374151] border-b border-[#E8E9F2] pb-2">Address & Guardian</p>
            {[
              ['Permanent Address', user.permanent_address],
              ['Current City', user.current_city],
              ['Guardian Name', user.guardian_name],
              ['Guardian Phone', user.guardian_phone],
              ['Guardian Address', user.guardian_address],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">{label}</span>
                <span className="text-[#0D0D12] font-medium text-right max-w-[60%]">{val}</span>
              </div>
            ) : null)}
          </Card>
        </div>
      )}

      {/* Documents tab — shows all uploaded ID photos */}
      {tab === 'Documents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocImage label="Aadhaar Card (Front)" url={user.aadhaar_front_url}    verified={bgv.aadhaar_verification === 'verified'} />
            <DocImage label="Aadhaar Card (Back)"  url={user.aadhaar_back_url}     verified={bgv.aadhaar_verification === 'verified'} />
            <DocImage label="PAN Card"             url={user.pan_card_url}          verified={false} />
            <DocImage label="Driving License"      url={user.driving_license_url}   verified={false} />
            <DocImage label="Passport"             url={user.passport_url}          verified={false} />
          </div>

          {/* Download police verification application form */}
          <Btn variant="outline" onClick={downloadVerifPDF} className="w-full">
            <FileText className="w-4 h-4" />
            Download Police Verification Form (PDF)
          </Btn>
        </div>
      )}

      {/* Verification tab */}
      {tab === 'Verification' && (
        <div className="space-y-4">
          <VerifCard label="Police Verification"      statusKey="police_verification"  notesKey="police_notes"  bgv={bgv} onUpdate={updateBGV} />
          <VerifCard label="Aadhaar / ID Verification" statusKey="aadhaar_verification" notesKey="aadhaar_notes" bgv={bgv} onUpdate={updateBGV} />
          <VerifCard label="Work / Study Verification" statusKey="work_verification"    notesKey="work_notes"    bgv={bgv} onUpdate={updateBGV} />

          {allVerified && !user.is_approved && (
            <Btn className="w-full h-12 text-sm" onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
              <BadgeCheck className="w-5 h-5" />
              Approve Tenant and Grant Blue Tick Verification
            </Btn>
          )}
          {!allVerified && (
            <p className="text-center text-xs text-[#9CA3AF] py-2">Complete all 3 verifications above to approve the tenant</p>
          )}
          {user.is_approved && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-200">
              <BadgeCheck className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-700">Tenant is Verified</p>
                <p className="text-xs text-blue-500">Blue tick verification badge is active on their profile</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rent tab */}
      {tab === 'Rent' && (
        <div className="space-y-3">
          {rentRecords.length === 0 ? (
            <p className="text-center text-sm text-[#9CA3AF] py-8">No rent records yet. Generate monthly dues first.</p>
          ) : rentRecords.map(r => (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#0D0D12]">{r.month_year}</p>
                <div className="flex gap-3 text-xs text-[#6B7280] mt-0.5">
                  <span>Due: {formatRupees(r.amount_due)}</span>
                  {r.amount_paid && <span className="text-emerald-600">Paid: {formatRupees(r.amount_paid)}</span>}
                  {r.paid_date   && <span>on {formatDate(r.paid_date)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={r.status} />
                {r.status !== 'paid' && (
                  <Btn size="sm" onClick={() => { setPayModal(r.id); setPayForm({ amount_paid: r.amount_due, paid_date: '', payment_mode: 'upi', transaction_id: '', notes: '' }) }}>
                    Confirm
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Complaints tab */}
      {tab === 'Complaints' && (
        <div className="space-y-3">
          {complaints.length === 0 ? (
            <p className="text-center text-sm text-[#9CA3AF] py-8">No complaints from this tenant.</p>
          ) : complaints.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-[#0D0D12]">{c.title}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{c.description}</p>
                </div>
                <Badge status={c.status} />
              </div>
              <div className="flex gap-2 mt-2 text-xs text-[#9CA3AF]">
                <span className="capitalize">{c.category?.replace(/_/g,' ')}</span>
                <span>|</span>
                <span>{formatDate(c.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm payment modal */}
      {payModal && (
        <Modal title="Confirm Payment" onClose={() => setPayModal(null)}>
          <div className="space-y-3">
            <Input label="Amount Paid" type="number" value={payForm.amount_paid} onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))} />
            <Input label="Payment Date" type="date" value={payForm.paid_date} onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#374151] uppercase tracking-wide">Payment Mode</label>
                <select className="w-full h-10 border border-[#E8E9F2] rounded-xl px-3.5 text-sm outline-none focus:border-brand-500"
                  value={payForm.payment_mode} onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  {['cash','upi','neft','cheque','other'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <Input label="Transaction ID" value={payForm.transaction_id} onChange={e => setPayForm(f => ({ ...f, transaction_id: e.target.value }))} />
            </div>
            <Textarea label="Notes" rows={2} value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
            <div className="flex gap-2 pt-2">
              <Btn variant="outline" className="flex-1" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn className="flex-1" onClick={() => confirmPayMutation.mutate()} loading={confirmPayMutation.isPending}>Confirm Payment</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
